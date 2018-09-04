#include "Wire.h"
#include <Adafruit_Sensor.h>
#include <Adafruit_LSM303_U.h> //mag and accel
#include <Adafruit_TSL2561_U.h> //light
#include <Adafruit_Si4713.h> //radio
#include <Adafruit_GPS.h> // gps

//DEBUG MODE
boolean DEBUGMODE = false;

#define TCAADDR 0x70 //i2c address for i2c multiplexer
#define GPSHardSerial Serial1
#define ACCELADDR 3 //addresses for sensors
#define RADIOADDR 2
#define RADIORESETPIN 21
#define LIGHTTADDR 1
#define LIGHTADDR 0
#define Pi 3.14159;

Adafruit_LSM303_Accel_Unified accel = Adafruit_LSM303_Accel_Unified(1); //accel sensor
Adafruit_LSM303_Mag_Unified mag = Adafruit_LSM303_Mag_Unified(2); //mag sensor
Adafruit_TSL2561_Unified tsl1 = Adafruit_TSL2561_Unified(TSL2561_ADDR_HIGH, 3); //on i2c 0 is high
Adafruit_TSL2561_Unified tsl2 = Adafruit_TSL2561_Unified(TSL2561_ADDR_LOW, 4); //on i2c 1 is low
Adafruit_Si4713 radio = Adafruit_Si4713(21);
Adafruit_GPS GPS(&GPSHardSerial); //set up gps

boolean magConnected = false;
boolean accelConnected = false;
boolean tsl1Connected = false;
boolean tsl2Connected = false;
boolean radioConnected = false;

#define maxCommandSize 30 //maximum command size from nodejs
const char* commandSplitChar=";";
const char* commandValueChar="|";

boolean connected=false;
boolean running= true;

unsigned long lastSendTime = 0;
int sendConnectInterval = 1000;
unsigned long maxTimeBeforeConnect = 300000; //max time before connect is 5 minutes

String serverUptime, serverStatus, serverUsers = "";


void tcaselect(uint8_t i) {
  if (i > 7) return;
 
  Wire.beginTransmission(TCAADDR);
  Wire.write(1 << i);
  Wire.endTransmission();
  delay(25); //give some time to propagate
}

void debugPrintln(char *s) {
  if (DEBUGMODE) {
    Serial.println(s);
  }
}
void debugPrint(char *s) {
  if (DEBUGMODE) {
    Serial.print(s);
  }
}

void sendCommand(String command, String *value, uint8_t valueLen) {
  valueLen = (valueLen/sizeof(String));
  Serial.print(command);
  if (valueLen > 0) {
    Serial.print(commandValueChar);
    for (int i=0; i<valueLen; i++) {
      Serial.print(*value);
      *value++;
      if (valueLen > 1 && (i < (valueLen-1))) {
        Serial.print(","); //print comma
      }
    }
  }
  Serial.print(commandSplitChar);
}

void displaySensorDetailsAccel(void)
{
  sensor_t sensor;
  accel.getSensor(&sensor);
  printSensorDetails(sensor);
}

void displaySensorDetailsMag(void)
{
  sensor_t sensor;
  mag.getSensor(&sensor);
  printSensorDetails(sensor);
}

void displaySensorDetailsTsl1(void)
{
  sensor_t sensor;
  tsl1.getSensor(&sensor);
  printSensorDetails(sensor);
}

void displaySensorDetailsTsl2(void)
{
  sensor_t sensor;
  tsl2.getSensor(&sensor);
  printSensorDetails(sensor);
}

void printSensorDetails(sensor_t sensor)
{
  Serial.println("------------------------------------");
  Serial.print  ("Sensor:       "); Serial.println(sensor.name);
  Serial.print  ("Driver Ver:   "); Serial.println(sensor.version);
  Serial.print  ("Unique ID:    "); Serial.println(sensor.sensor_id);
  Serial.print  ("Max Value:    "); Serial.print(sensor.max_value); Serial.println(" m/s^2");
  Serial.print  ("Min Value:    "); Serial.print(sensor.min_value); Serial.println(" m/s^2");
  Serial.print  ("Resolution:   "); Serial.print(sensor.resolution); Serial.println(" m/s^2");
  Serial.println("------------------------------------");
  Serial.println("");
}
 
// standard Arduino setup()
void setup()
{
  #ifndef ESP8266
    while (!Serial);     // will pause Zero, Leonardo, etc until serial console opens
  #endif
  Serial.begin(115200);
  debugPrintln("ALLSENSOR Test"); debugPrintln("");
  
  /* Initialise the 1st sensor */
  debugPrintln("Selecting accel");
  tcaselect(ACCELADDR);
  debugPrintln("Selected accel");
  if(!accel.begin())
  {
    debugPrintln("No accel sensor detected");
    accelConnected = false;
  } else {
    debugPrintln("ACCEL OK");
    accelConnected = true;
    if (DEBUGMODE) {
      displaySensorDetailsAccel();
    }
  }

  debugPrintln("Selecting mag");
  tcaselect(ACCELADDR);
  debugPrintln("Selected mag (sameAddr)");
  mag.enableAutoRange(true);
  if(!mag.begin())
  {
    debugPrintln("No mag sensor detected");
    magConnected = false;
  } else {
    debugPrintln("MAG OK");
    magConnected = true;
    if (DEBUGMODE) {
      displaySensorDetailsMag();
    }
  }
  if (!accelConnected) {
    debugPrintln("Trying accel again");
    if(!accel.begin())
    {
      debugPrintln("No accel sensor detected (2nd time, giving up)");
      accelConnected = false;
    } else {
      debugPrintln("ACCEL OK");
      accelConnected = true;
      if (DEBUGMODE) {
        displaySensorDetailsAccel();
      }
    }
  }

  debugPrintln("Selecting tsl1");
  tcaselect(LIGHTADDR);
  debugPrintln("Selected tsl1");
  if(!tsl1.begin())
  {
    debugPrintln("No tsl1 sensor detected");
    tsl1Connected = false;
  } else {
    debugPrintln("TSL1 OK");
    tsl1Connected = true;
    tsl1.enableAutoRange(true);
    tsl1.setIntegrationTime(TSL2561_INTEGRATIONTIME_13MS);
    if (DEBUGMODE) {
      Serial.println("-LUX1-------------------------------");
      Serial.print("Gain:         "); debugPrintln("Auto");
      Serial.print("Timing:       "); debugPrintln("13 ms");
      Serial.println("------------------------------------");
      displaySensorDetailsTsl1();
    }
  }

  debugPrintln("Selecting tsl2");
  tcaselect(LIGHTTADDR);
  debugPrintln("Selected tsl2");
  if(!tsl2.begin())
  {
    debugPrintln("No tsl2 sensor detected");
    tsl2Connected = false;
  } else {
    debugPrintln("TSL2 OK");
    tsl2Connected = true;
    tsl2.enableAutoRange(true);
    tsl2.setIntegrationTime(TSL2561_INTEGRATIONTIME_13MS);
    if (DEBUGMODE) {
      Serial.println("-LUX2-------------------------------");
      Serial.print  ("Gain:         "); Serial.println("Auto");
      Serial.print  ("Timing:       "); Serial.println("13 ms");
      Serial.println("------------------------------------");
      displaySensorDetailsTsl2();
    }
  }

  debugPrintln("Selecting radio");
  pinMode(RADIORESETPIN, OUTPUT);
  tcaselect(RADIOADDR);
  debugPrintln("Selected radio");
  if(!radio.begin())
  {
    debugPrintln("No radio detected");
    radioConnected = false;
  } else {
    debugPrintln("RADIO OK");
    radioConnected = true;
  }

  debugPrintln("Starting GPS");
  GPS.begin(9600);
  GPS.sendCommand(PMTK_SET_NMEA_OUTPUT_RMCGGA); //set as fix and recommended minimum data
  GPS.sendCommand(PMTK_SET_NMEA_UPDATE_1HZ); // 1 Hz update rate (once per second)
  GPS.sendCommand(PGCMD_ANTENNA); //request updates on antenna status
  delay(1000);

  // Ask for firmware version
  GPSHardSerial.println(PMTK_Q_RELEASE);
  debugPrintln("Started GPS");
  
}
 
void loop() 
{
  if (running) {
    String input = Serial.readString();
    input.trim();
    if (connected == false) {
      input.toLowerCase();
      if (millis()-lastSendTime >= sendConnectInterval) { //output every second
        Serial.print("AOK");
        Serial.print(commandSplitChar);
        lastSendTime+=sendConnectInterval;
        if (lastSendTime > maxTimeBeforeConnect) {
          Serial.print("timeout;");
          running = false;
        }
      }
      if (input.indexOf("sok")>-1) {
        Serial.print("CONN");
        Serial.print(commandSplitChar);
        connected = true;
      }
    } else {
      processCommand: //setup label
      if (input.indexOf(commandSplitChar)>-1) { //validate that it is a command
         //int stind = input.indexOf(commandSplitChar);
         int endind = input.indexOf(commandSplitChar);
         int valind = input.indexOf(commandValueChar);

         String command = "";
         String value = "";

         if (valind == -1) {
          command = input.substring(0,endind);
         } else {
          command = input.substring(0,valind);
          value = input.substring(valind+1,endind);
         }

         command.toLowerCase(); //conv command to lowercase


        if (command == "uptime") {
             serverUptime = value;
        } else if (command == "status") {
             serverStatus = value;
        } else if (command == "users") {
             serverUsers = value;
        } else if (command == "debugon") {
          DEBUGMODE = true;
        } else if (command == "debugoff") {
          DEBUGMODE = false;
        } else if (command == "sensorstatus") {
          String values[] = {"OTEMP=1", "ITEMP=1", ("ACCEL="+String(accelConnected)), ("MAG="+String(magConnected)), ("TSL1="+String(tsl1Connected)), ("TSL2="+String(tsl2Connected)), ("RADIO="+String(radioConnected))};
          sendCommand("SENSORSTATUS", values,sizeof(values));
        } else if (command == "sensorupdate") {
          if (tsl1Connected) { //is the light sensor connected?
            tcaselect(LIGHTADDR);
            sensors_event_t ts1event;
            tsl1.getEvent(&ts1event);
            if (ts1event.light) {
              String values[] = {"LIGHT="+String(ts1event.light)};
              sendCommand("TSL1DATA",values,sizeof(values));
              if (DEBUGMODE) {
                Serial.print(ts1event.light); Serial.println(" lux1");
              }
            } else {
              sendCommand("TSL1OVERLOAD",{},0);
              if (DEBUGMODE) {
                Serial.println("tsl1 sensor overload");
              }
            }
          }
        
          if (tsl2Connected) {
            tcaselect(LIGHTTADDR);
            sensors_event_t ts2event;
            tsl2.getEvent(&ts2event);
            if (ts2event.light) {
              String values[] = {"LIGHT="+String(ts2event.light)};
              sendCommand("TSL2DATA",values,sizeof(values));
              if (DEBUGMODE) {
                Serial.print(ts2event.light); Serial.println(" lux2");
              }
            } else {
              sendCommand("TSL2OVERLOAD",{},0);
              if (DEBUGMODE) {
                Serial.println("tsl2 sensor overload");
              }
            }
          }
        
          if (accelConnected || magConnected) {
            tcaselect(ACCELADDR);
            if (accelConnected) {
              sensors_event_t accelevent;
              accel.getEvent(&accelevent);

              String values[] = {("X="+String(accelevent.acceleration.x)), ("Y="+String(accelevent.acceleration.y)), ("Z="+String(accelevent.acceleration.z))};
              sendCommand("ACCELDATA",values,sizeof(values));
              if (DEBUGMODE) {
                Serial.print("X: "); Serial.print(accelevent.acceleration.x); Serial.print("  ");
                Serial.print("Y: "); Serial.print(accelevent.acceleration.y); Serial.print("  ");
                Serial.print("Z: "); Serial.print(accelevent.acceleration.z); Serial.print("  ");Serial.println("m/s^2 ");
              }
            }
            if (magConnected) {
              sensors_event_t magevent;
              mag.getEvent(&magevent);

              float heading = (atan2(magevent.magnetic.y,magevent.magnetic.x) * 180) / Pi;
              if (heading < 0)
              {
                heading = 360 + heading;
              }

              String values[] = {("X="+String(magevent.magnetic.x)), ("Y="+String(magevent.magnetic.y)), ("Z="+String(magevent.magnetic.z)), ("HEADING="+String(heading))};
              sendCommand("MAGDATA",values,sizeof(values));
              
              if (DEBUGMODE) {
                Serial.print("X: "); Serial.print(magevent.magnetic.x); Serial.print("  ");
                Serial.print("Y: "); Serial.print(magevent.magnetic.y); Serial.print("  ");
                Serial.print("Z: "); Serial.print(magevent.magnetic.z); Serial.print("  ");Serial.println("uT");
                Serial.print("Heading: "); Serial.println(heading);
              }
            }
            if (true) {
              String values[] = {"OTEMP=60", "ITEMP=75"};
              sendCommand("TEMPDATA",values,sizeof(values));
            }
          }
        
          if (GPS.fix) {
            String values[] = {("LAT="+String(GPS.latitude)), ("LNG="+String(GPS.longitude)), ("SPEED="+String(GPS.speed)), ("ANGLE="+String(GPS.angle)), ("ALTITUDE="+String(GPS.altitude)), ("SAT="+String(GPS.satellites)), ("FIX="+String(GPS.fix)), ("FIXQUAL="+String(GPS.fixquality))};
            sendCommand("GPSDATA",values,sizeof(values));
              if (DEBUGMODE) {
                Serial.print("Location: ");
                Serial.print(GPS.latitude, 4); Serial.print(GPS.lat);
                Serial.print(", ");
                Serial.print(GPS.longitude, 4); Serial.println(GPS.lon);
                Serial.print("Speed (knots): "); Serial.println(GPS.speed);
                Serial.print("Angle: "); Serial.println(GPS.angle);
                Serial.print("Altitude: "); Serial.println(GPS.altitude);
                Serial.print("Satellites: "); Serial.println((int)GPS.satellites);
              }
          } else {
            String values[] = {("FIX="+String(GPS.fix)), ("FIXQUAL="+String(GPS.fixquality))};
            sendCommand("GPSDATA",values,sizeof(values));
            if (DEBUGMODE) {
              Serial.print("Fix: "); Serial.print((int)GPS.fix);
              Serial.print(" quality: "); Serial.println((int)GPS.fixquality);
            }
          }
        } else {
          Serial.print("UNC|"+command+";");
        }
        input = input.substring(endind+1);
        if (input != "") { //more commands
          goto processCommand;
        }
      }
    }
  }
  
  char c = GPS.read(); //read from gps
  if (GPS.newNMEAreceived()) {
    if (DEBUGMODE) {
      Serial.print("GPS lastNMEA: ");
      Serial.println(GPS.lastNMEA());
    }
      
    GPS.parse(GPS.lastNMEA()); //parse it
  }
}
