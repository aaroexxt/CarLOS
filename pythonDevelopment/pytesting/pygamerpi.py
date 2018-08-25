#pygamerpi.py by Aaron Becker
#C.OS. V1

#imports
import pygame
from pygame.locals import *
import os
import sys
import math
from time import sleep
from socketIO_client import SocketIO, LoggingNamespace
from datetime import datetime
from multiprocessing.pool import Pool
from screeninfo import get_monitors

#color definitions
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
YELLOW = (255, 255, 0)
#mons = get_monitors('osx')
mons = {}
if len(mons) > 1:
    print("More than 1 monitor detected! Using first monitor.")
    monitor = mons[0]
elif len(mons) == 0:
    print("No monitors detected. Using default resolution.")
    monitor = { "width": 640, "height": 480 }
else:
    print("Monitor detected")
    monitor = mons[0]

print("init: monitor width, height "+str(monitor["width"]),str(monitor["height"]))
x = 0
y = 0
socketin = []
global socket

#socket recieve functions
def on_recieve(*data):
    global socketin
    socketin.append(str(data)[2:len(str(data))-3])

def socket_connected(*data):
    print('Connected to socket.io :)')

def py_ready(*data):
    socket.emit('pyok','')

#start pygame
pygame.init()
pygame.mouse.set_visible(True)
screen = pygame.display.set_mode((monitor["width"], monitor["height"]),pygame.RESIZABLE)
width, height = screen.get_size()
pygame.display.set_caption('C.OS. V1')
screen.fill((0,0,0))
pygame.display.update()

if not pygame.font: print ('PYGAME: Warning, fonts disabled')
if not pygame.mixer: print ('PYGAME: Warning, sound disabled')

#pygame loop
if pygame.font:
    font_big = pygame.font.Font(None, 50)
    font_small = pygame.font.Font(None, 20)
    font_med = pygame.font.Font(None, 35)
else:
    print ("Error with font")
    raise (SystemError, "Error with font")
    #font_big = fakeFont(None, 50) #make a fake font so pygame throws no errors

"""class fakeFont(type):
    def __init__(self, *args, **kwargs):
        print("fake font init")
    def render(self, *args, **kwargs):
        print("fake font render")"""

#load sound function
def load_sound(name):
    class NoneSound:
        def play(self): pass
    if not pygame.mixer:
        return NoneSound()
    fullname = os.path.join('data', name)
    try:
        sound = pygame.mixer.Sound(fullname)
    except (pygame.error, message):
        print ('Cannot load sound:', wav)
        raise (SystemExit, message)
    return sound

#load image function
def load_image(name, colorkey=None):
    fullname = os.path.join('data', name)
    try:
        image = pygame.image.load(fullname)
    except (pygame.error, message):
        print ('Cannot load image:', name)
        raise (SystemExit, message)
    image = image.convert()
    if colorkey is not None:
        if colorkey is -1:
            colorkey = image.get_at((0,0))
        image.set_colorkey(colorkey, RLEACCEL)
    return image, image.get_rect()

def map(value, leftMin, leftMax, rightMin, rightMax):
    # Figure out how 'wide' each range is
    leftSpan = leftMax - leftMin
    rightSpan = rightMax - rightMin

    # Convert the left range into a 0-1 range (float)
    valueScaled = float(value - leftMin) / float(leftSpan)

    # Convert the 0-1 range into a value in the right range.
    return rightMin + (valueScaled * rightSpan)

def render_font(font,scr,text,color,x,y):
    text_surface = font.render(text, True, color)
    rect = text_surface.get_rect(center=(x,y))
    scr.blit(text_surface, rect)
    pygame.display.update()

def clr_rect(x,y,width,height):
    #if type(thicc) != int or type(thicc) != float:
    #    thicc = 0
    pygame.draw.rect(screen, BLACK, (int(x), int(y), width, height), 0)
    pygame.display.update()

def sgn(num):
    if (num < 0):
        return -1
    elif (num == 0):
        return 0
    elif (num > 0):
        return 1
    else:
        return "err"
#init function
def intro():
    screen.fill(BLACK)
    pygame.draw.circle(screen, WHITE, (int(width/2), int(height/2)), 70, 2) #draw circle
    render_font(font_med,screen,"Car OS",RED,width/2,(height/2)-10)
    render_font(font_big,screen,"V1",RED,width/2,(height/2)+25)
    pygame.display.update()

    steps = 8 #degree steps (16 and 8 are good)
    rad = 70 #radius
    dist = 100 #distance to travel along line
    finalang = 180
    mag = 5 #sin magnitude
    i = finalang/steps
    pixobj = pygame.PixelArray(screen)
    while int(i) > 0:
        angleoffset = steps*i/(finalang/360)
        if (i*steps > 180):
            ptstartx = (width/2)+(rad*math.cos(angleoffset)) #calculate starting point on circle
            ptstarty = (height/2)+(rad*math.sin(angleoffset))

            ptendx = ptstartx+(dist*math.cos(angleoffset)) #calculate end point
            ptendy = ptstarty+(dist*math.sin(angleoffset))
        else:
            ptstartx = (width/2)-(rad*math.cos(angleoffset)) #calculate starting point on circle
            ptstarty = (height/2)-(rad*math.sin(angleoffset))

            ptendx = ptstartx-(dist*math.cos(angleoffset)) #calculate end point
            ptendy = ptstarty-(dist*math.sin(angleoffset))
        print("psx:"+str(ptstartx)+", psy: "+str(ptstarty)+", off: "+str(angleoffset))

        pygame.draw.line(screen, YELLOW, (ptstartx, ptstarty), (ptendx, ptendy), 2)
        pygame.display.update()
        #sleep(0.025)
        """dx = ptendx - ptstartx
        dy = ptendy - ptstarty
        deltaerror = abs(dy/ dx)
        error = 0
        y = ptstarty

        for x in range(int(ptstartx), int(ptendx+1)):
            pixobj[int(x)][int(y)] = GREEN
            error += deltaerror
            while error >= 0.5:
                y += sgn(dy)
                error -= 1
            pygame.display.update()"""

        """j = 0
        while j < pts:
            #apply sin functin
            #x = ptstartx+j
            #y = ptstarty+(((angleoffset/10)*x)+(((angleoffset/5)+1)*math.sin(x)))
            #jk to complex just travel in a straight line
            print(int(x),int(y))
            pixobj[int(x)][int(y)] = GREEN
            j+=1
            pygame.display.update()"""
        i-=1
        print (i)
    print("init seq done")
    del pixobj
    sleep(0.5)

    def clr_text():
        clr_rect(100,height-70,width,40)

    i = 0
    while int(i) < 10:
        if int(i) == 0:
            render_font(font_med,screen,"Initializing websockets...",WHITE,width/2,height-50)

            #setup socket
            global socket
            socket = SocketIO( 'localhost', 80, LoggingNamespace );
            import logging
            logging.getLogger('socketIO-client').setLevel(logging.DEBUG)
            logging.basicConfig()
            socket.emit('initpython', 'ready');
        elif int(i) == 1:
            clr_text()
            render_font(font_med,screen,"Websockets initialized.",WHITE,width/2,height-50)
            sleep(1)
            clr_text()
            render_font(font_med,screen,"Attaching socket listeners...",WHITE,width/2,height-50)

            #setup socket functions
            socket.on('connect', socket_connected )
            socket.on('pyready', py_ready )
            socket.on('pydata', on_recieve )
            socket.wait(seconds=1)
        elif int(i) == 2:
            clr_text()
            render_font(font_med,screen,"Socket listeners attached.",WHITE,width/2,height-50)
            sleep(1)
        else:
            print (i)
        i+=1

intro()
running = True
fs = False
while running:
    screen.fill(BLACK)
    for event in pygame.event.get():
        if(event.type is pygame.MOUSEMOTION):
            pos = pygame.mouse.get_pos()
            print (pos)
            #Find which quarter of the screen we're in
            x,y = pos
        elif(event.type == pygame.QUIT):
            running = False
            socket.emit('pydisconnect','')
            print('Sending pydisconnect event...')
            pygame.quit()
    keys = pygame.key.get_pressed()
    i = 0
    while i < len(keys):
        if keys[i] == 1:
            print (i)
        i+=1
    print (pygame.key.get_mods())
    if (pygame.key.get_mods() == 1024 and (keys[113] == 1 or keys[119] == 1)) or keys[27] == 1:
        pygame.quit()
    if pygame.key.get_mods() == 1024 and keys[102] == 1:
        if fs == False:
            screen = pygame.display.set_mode((0,0), pygame.FULLSCREEN)
            fs = True
        else:
            screen = pygame.display.set_mode((width,height - 120),pygame.RESIZABLE)
            fs = False
    pt = " "
    for ev in socketin:
        command = ev[:1]
        value = ev[2:]
        if (command=="p"):
            pt+=value
        print ("EvQueue processing: "+command+" "+value)
        socketin.remove(ev)
    text_surface = font_big.render(str(x)+","+str(y)+","+pt, True, WHITE)
    rect = text_surface.get_rect(center=(160,120))
    screen.blit(text_surface, rect)
    pygame.display.update()
    #now = datetime.now()
    #socket.emit( 'python', now.strftime( "%-d %b %Y %H:%M:%S.%f" ) )
    socket.wait(seconds=0.1)
