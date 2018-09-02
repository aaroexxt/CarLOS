#include "Wire.h"
#include <Adafruit_Sensor.h>
#include <Adafruit_LSM303_U.h> //mag and accel
#include <Adafruit_TSL2561_U.h> //light
#include <Adafruit_Si4713.h> //radio
#include <Adafruit_GPS.h> // gps
 
#define TCAADDR 0x70

#define GPSHardSerial Serial1
#define ACCELADDR 3 //addresses for sensors
#define RADIOADDR 2
#define RADIORESETPIN 21
#define LIGHTTADDR 1
#define LIGHTADDR 0

Adafruit_LSM303_Accel_Unified accel = Adafruit_LSM303_Accel_Unified(1); //accel sensor
Adafruit_LSM303_Mag_Unified mag = Adafruit_LSM303_Mag_Unified(2); //mag sensor
Adafruit_TSL2561_Unified tsl1 = Adafruit_TSL2561_Unified(TSL2561_ADDR_HIGH, 3); //on i2c 0 is high
Adafruit_TSL2561_Unified tsl2 = Adafruit_TSL2561_Unified(TSL2561_ADDR_LOW, 4); //on i2c 1 is low
Adafruit_Si4713 radio = Adafruit_Si4713(RADIORESETPIN);
Adafruit_GPS GPS(&GPSHardSerial); //set up gps

boolean magConnected = false;
boolean accelConnected = false;
boolean tsl1Connected = false;
boolean tsl2Connected = false;
boolean radioConnected = false;

void tcaselect(uint8_t i) {
  if (i > 7) return;
 
  Wire.beginTransmission(TCAADDR);
  Wire.write(1 << i);
  Wire.endTransmission();
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
  Serial.println("ALLSENSOR Test"); Serial.println("");
  
  /* Initialise the 1st sensor */
  Serial.println("Selecting accel");
  tcaselect(ACCELADDR);
  Serial.println("Selected accel");
  if(!accel.begin())
  {
    Serial.println("No accel sensor detected");
    accelConnected = false;
  } else {
    Serial.println("ACCEL OK");
    accelConnected = true;
    displaySensorDetailsAccel();
  }

  Serial.println("Selecting mag");
  tcaselect(ACCELADDR);
  Serial.println("Selected mag");
  mag.enableAutoRange(true);
  if(!mag.begin())
  {
    Serial.println("No mag sensor detected");
    magConnected = false;
  } else {
    Serial.println("MAG OK");
    magConnected = true;
    displaySensorDetailsMag();
  }

  Serial.println("Selecting tsl1");
  tcaselect(LIGHTADDR);
  Serial.println("Selected tsl1");
  if(!tsl1.begin())
  {
    Serial.println("No tsl1 sensor detected");
    tsl1Connected = false;
  } else {
    Serial.println("TSL1 OK");
    tsl1Connected = true;
    tsl1.enableAutoRange(true);
    tsl1.setIntegrationTime(TSL2561_INTEGRATIONTIME_13MS);
    Serial.println("-LUX1-------------------------------");
    Serial.print  ("Gain:         "); Serial.println("Auto");
    Serial.print  ("Timing:       "); Serial.println("13 ms");
    Serial.println("------------------------------------");
    displaySensorDetailsTsl1();
  }

  Serial.println("Selecting tsl2");
  tcaselect(LIGHTTADDR);
  Serial.println("Selected tsl2");
  if(!tsl2.begin())
  {
    Serial.println("No tsl2 sensor detected");
    tsl2Connected = false;
  } else {
    Serial.println("TSL2 OK");
    tsl2Connected = true;
    tsl2.enableAutoRange(true);
    tsl2.setIntegrationTime(TSL2561_INTEGRATIONTIME_13MS);
    Serial.println("-LUX2-------------------------------");
    Serial.print  ("Gain:         "); Serial.println("Auto");
    Serial.print  ("Timing:       "); Serial.println("13 ms");
    Serial.println("------------------------------------");
    displaySensorDetailsTsl2();
  }

  Serial.println("Selecting radio");
  pinMode(RADIORESETPIN, OUTPUT);
  tcaselect(RADIOADDR);
  Serial.println("Selected radio");
  if(!radio.begin())
  {
    Serial.println("No radio detected");
    radioConnected = false;
  } else {
    Serial.println("RADIO OK");
    radioConnected = true;
  }

  Serial.println("Starting GPS");
  GPS.begin(9600);
  GPS.sendCommand(PMTK_SET_NMEA_OUTPUT_RMCGGA); //set as fix and recommended minimum data
  GPS.sendCommand(PMTK_SET_NMEA_UPDATE_1HZ); // 1 Hz update rate (once per second)
  GPS.sendCommand(PGCMD_ANTENNA); //request updates on antenna status
  delay(1000);

  // Ask for firmware version
  GPSHardSerial.println(PMTK_Q_RELEASE);
  Serial.println("Started GPS");
  
}
 
void loop() 
{
  if (tsl1Connected) {
    tcaselect(LIGHTADDR);
    sensors_event_t ts1event;
    tsl1.getEvent(&ts1event);
    if (ts1event.light) {
      Serial.print(ts1event.light); Serial.println(" lux1");
    } else {
      Serial.println("tsl1 sensor overload");
    }
  }

  if (tsl2Connected) {
    tcaselect(LIGHTTADDR);
    sensors_event_t ts2event;
    tsl2.getEvent(&ts2event);
    if (ts2event.light) {
      Serial.print(ts2event.light); Serial.println(" lux2");
    } else {
      Serial.println("Sensor overload");
    }
  }

  if (accelConnected || magConnected) {
    tcaselect(ACCELADDR);
    if (accelConnected) {
      
    }
    if (magConnected) {
      sensors_event_t magevent;
      mag.getEvent(&magevent);
      /* Display the results (magnetic vector values are in micro-Tesla (uT)) */
      Serial.print("X: "); Serial.print(magevent.magnetic.x); Serial.print("  ");
      Serial.print("Y: "); Serial.print(magevent.magnetic.y); Serial.print("  ");
      Serial.print("Z: "); Serial.print(magevent.magnetic.z); Serial.print("  ");Serial.println("uT");
    }
  }
  
  char c = GPS.read(); //read from gps
  if (GPS.newNMEAreceived()) {
    Serial.println(GPS.lastNMEA());
    if (GPS.parse(GPS.lastNMEA())) {
      if (GPS.fix) {
        Serial.print("Location: ");
        Serial.print(GPS.latitude, 4); Serial.print(GPS.lat);
        Serial.print(", ");
        Serial.print(GPS.longitude, 4); Serial.println(GPS.lon);
        Serial.print("Speed (knots): "); Serial.println(GPS.speed);
        Serial.print("Angle: "); Serial.println(GPS.angle);
        Serial.print("Altitude: "); Serial.println(GPS.altitude);
        Serial.print("Satellites: "); Serial.println((int)GPS.satellites);
      } else {
        Serial.print("Fix: "); Serial.print((int)GPS.fix);
        Serial.print(" quality: "); Serial.println((int)GPS.fixquality);
      }
    }
  }
  
  delay(250);
}
