// include the library code:
#include <Wire.h>
#include <Adafruit_RGBLCDShield.h>
#include <utility/Adafruit_MCP23017.h>
//Setup lcd
Adafruit_RGBLCDShield lcd = Adafruit_RGBLCDShield();

// These #defines make it easy to set the backlight color
#define OFF 0x0
#define RED 0x1
#define YELLOW 0x3
#define GREEN 0x2
#define TEAL 0x6
#define BLUE 0x4
#define VIOLET 0x5
#define WHITE 0x7
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

unsigned long lastCommandTime = 0;
int timeBeforeStatScreen = 10000;

unsigned long lastUpdateTime = 0;
int minScreenUpdateTime = 1000;

void setup() {
  // Debugging output
  Serial.begin(9600);
  Serial.print("CarOS Arduino V1");
  Serial.print(commandSplitChar);
  // set up the LCD's number of columns and rows: 
  lcd.begin(16, 2);
  lcd.setBacklight(WHITE);
  lcd.print("Welcome to CarOS");
  lcd.setCursor(0,1);
  lcd.print("Waiting4server");
}

void loop() {
  if (running) {
    String input = Serial.readString();
    input.trim();
    if (connected == false) {
      if (millis()-lastSendTime >= sendConnectInterval) { //output every second
        Serial.print("AOK");
        Serial.print(commandSplitChar);
        lastSendTime+=sendConnectInterval;
        if (lastSendTime > maxTimeBeforeConnect) {
          lcd.clear();
          lcd.setCursor(0,0);
          lcd.print("Timeout :(");
          lcd.setCursor(0,1);
          lcd.print("Press RESET");
          running = false;
        }
      }
      if (input == "SOK") {
        Serial.print("CONN");
        Serial.print(commandSplitChar);
        connected = true;
        lcd.clear();
        lcd.setCursor(0,0);
        lcd.print("Connected");
      }
    } else {
      char *p, *i, *command, *value;
      char charBuf[input.length() + 1];
      input.toCharArray(charBuf, input.length());
      if (charBuf[0] == ';') { //validate that it is a command
        command = strtok_r(charBuf,commandValueChar,&i);
        String scommand = String(command);
        scommand = scommand.substring(1);
        
        //  Second strtok iteration
        value = strtok_r(NULL,commandValueChar,&i);
        String svalue = String(value);

        if (scommand == "lcd") {
            lcd.clear();
            lcd.setCursor(0,0);
            lcd.print(svalue);
            lastCommandTime = millis(); //display for 10 seconds
        } else if (scommand == "uptime") {
             serverUptime = svalue;
             //lastCommandTime = 0;
        } else if (scommand == "status") {
             serverStatus = svalue;
             //lastCommandTime = 0;
        } else if (scommand == "users") {
             serverUsers = svalue;
             //lastCommandTime = 0;
        } else {
          Serial.print("UNC: "+scommand+";");
        }

        if (millis()-lastCommandTime >= timeBeforeStatScreen && millis()-lastUpdateTime >= minScreenUpdateTime) {
          lastUpdateTime += minScreenUpdateTime;
          Serial.print("INFO"); //request new info
          Serial.print(commandSplitChar);
          lcd.clear();
          lcd.setCursor(0,0);
          lcd.print("STATUS: "+serverStatus);
          lcd.setCursor(0,1);
          lcd.print("uT:"+serverUptime);//+" U:"+serverUsers);
        }
      }
    }
  }

  uint8_t buttons = lcd.readButtons();

  if (buttons) {
    lcd.clear();
    lcd.setCursor(0,0);
    if (buttons & BUTTON_UP) {
      lcd.print("UP ");
      lcd.setBacklight(RED);
    }
    if (buttons & BUTTON_DOWN) {
      lcd.print("DOWN ");
      lcd.setBacklight(YELLOW);
    }
    if (buttons & BUTTON_LEFT) {
      lcd.print("LEFT ");
      lcd.setBacklight(GREEN);
    }
    if (buttons & BUTTON_RIGHT) {
      lcd.print("RIGHT ");
      lcd.setBacklight(TEAL);
    }
    if (buttons & BUTTON_SELECT) {
      lcd.print("SELECT ");
      lcd.setBacklight(VIOLET);
    }
  }
}

