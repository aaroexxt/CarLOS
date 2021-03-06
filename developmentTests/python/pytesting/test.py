import sys, pygame
import os
from socketIO_client import SocketIO, LoggingNamespace
from datetime import datetime
os.environ['SDL_VIDEO_CENTERED'] = '1'
pygame.init()

size = width, height = 320, 240
speed = [2, 2]
black = 0, 0, 0

try:
    screen = pygame.display.set_mode(size)

    ball = pygame.image.load("/Users/Aaron/Desktop/Code/nodejs/index/ball.bmp")
    ballrect = ball.get_rect()

    while 1:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                break
        now = datetime.now()
        with SocketIO( 'localhost', 80, LoggingNamespace ) as socketIO:
            socketIO.emit( 'python-message', now.strftime( "%-d %b %Y %H:%M:%S.%f" ) )
            socketIO.wait( seconds=1 )

        ballrect = ballrect.move(speed)
        if ballrect.left < 0 or ballrect.right > width:
            speed[0] = -speed[0]
        if ballrect.top < 0 or ballrect.bottom > height:
            speed[1] = -speed[1]

        screen.fill(black)
        screen.blit(ball, ballrect)
        pygame.display.flip()
finally:
    pygame.quit