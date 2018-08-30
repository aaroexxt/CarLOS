// include the library code:
#include <Wire.h>

#define maxCommandSize 30

uint8_t i=0;
boolean connected=false;
boolean running= true;
const char* commandSplitChar=";";
const char* commandValueChar="|";
unsigned long lastSendTime = 0;
int sendConnectInterval = 1000;
unsigned long maxTimeBeforeConnect = 300000; //max time before connect is 5 minutes

String serverUptime, serverStatus, serverUsers = "";

String oldStatus, oldUsers, oldUptime = "";

boolean firstDisp = true;

unsigned long lastCommandTime = 0;
int timeBeforeStatScreen = 10000;

unsigned long lastUpdateTime = 0;
int minScreenUpdateTime = 1000;

void setup() {
  // Debugging output
  Serial.begin(9600);
  Serial.print("CarOS Arduino V1");
  Serial.print(commandSplitChar);

  /*
  // set up the LCD's number of columns and rows: 
  lcd.begin(16, 2);
  lcd.setBacklight(WHITE);
  lcd.print("Welcome to CarOS");
  lcd.setCursor(0,1);
  lcd.print("Waiting4server");*/
}

void loop() {
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
          /*lcd.clear();
          lcd.setCursor(0,0);
          lcd.print("Timeout :(");
          lcd.setCursor(0,1);
          lcd.print("Press RESET");*/
          Serial.print("timeout;");
          running = false;
        }
      }
      if (input.indexOf("sok")>-1) {
        Serial.print("CONN");
        Serial.print(commandSplitChar);
        connected = true;
        
        /*lcd.clear();
        lcd.setCursor(0,0);
        lcd.print("Connected");*/
        
        Serial.print("OTEMP"); //MAKE THIS ACTUALLY READ TEMP, outside temp
        Serial.print(commandValueChar);
        Serial.print("60");
        Serial.print(commandSplitChar);
        Serial.print("ITEMP"); //MAKE THIS ACTUALLY READ TEMP, inside temp
        Serial.print(commandValueChar);
        Serial.print("75");
        Serial.print(commandSplitChar);
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

        //Serial.println("comm "+command+", val "+value);

        if (command == "lcd") {
            /*lcd.clear();
            lcd.setCursor(0,0);
            lcd.print(value);*/
            lastCommandTime = millis()+(timeBeforeStatScreen-3000); //display for 3 seconds
        } else if (command == "uptime") {
             serverUptime = value;
             //lastCommandTime = 0;
        } else if (command == "status") {
             serverStatus = value;
             //lastCommandTime = 0;
        } else if (command == "users") {
             serverUsers = value;
             //lastCommandTime = 0;
        } else {
          Serial.print("UNC|"+command+";");
        }
        input = input.substring(endind+1);
        //Serial.println("input cont: "+input);
        if (input != "") { //more commands
          goto processCommand;
        }
      }
      //upd screen
      if (millis()-lastCommandTime >= timeBeforeStatScreen && millis()-lastUpdateTime >= minScreenUpdateTime) {
          lastUpdateTime += minScreenUpdateTime;
          Serial.print("INFO"); //request new info
          Serial.print(commandSplitChar);
          if (oldStatus != serverStatus || oldUptime != serverUptime || firstDisp) {
            if (firstDisp) {
              //lcd.clear();
              firstDisp = false;
            }
            if (oldStatus != serverStatus || firstDisp) {
              /*lcd.setCursor(0,0);
              lcd.print("Status: "+serverStatus+"     ");*/
            }
            if (oldUptime != serverUptime || firstDisp) {
              /*lcd.setCursor(0,1);
              lcd.print("uT: "+serverUptime+"     ");//+" U:"+serverUsers);*/
            }
            oldStatus = serverStatus;
            oldUsers = serverUsers;
            oldUptime = serverUptime;
          }
        }
    }
  }
}

