#rpibackend.py by Aaron Becker
#C.OS. V1

#imports
import os
import sys
sys.path.append('/usr/local/lib/python3.6/site-packages')
import math
from time import sleep
from socketIO_client import SocketIO, LoggingNamespace
import logging
from datetime import datetime
from multiprocessing.pool import Pool
import cv2
import numpy as np
import argparse#LFKJHDLKFJHDKLJFJKDOTHIS!!!<<<

debugMode = "false"

print ("init backend")
print ("opencv version "+cv2.__version__)

pyimgbasepath = "/Users/Aaron/Desktop/Code/nodejs/index/tmpimgs/out/"
pyimgnum = 0

x = 0
y = 0
socketin = []
pt = ""
global socket

#OpenCv face cascade
faceCascade = cv2.CascadeClassifier("/Users/Aaron/Desktop/Code/nodejs/index/python/opencv/haarcascade_frontalface_default.xml")
#OpenCv face recognizer
faceRecognizer = cv2.face.LBPHFaceRecognizer_create()

#socket recieve functions
def on_recieve(*data):
    global socketin
    socketin.append(str(data)[2:len(str(data))-3])

def socket_connected(*data):
    print('Connected to socket.io & listening :)')

def py_ready(*data):
    socket.emit('pyok','')

def sockcallback(*data):
    print(data)

print("setting up socket.io")
socket = SocketIO( 'localhost', 80, LoggingNamespace );
if (debugMode == "true"):
    print("Socket.IO DebugMode enabled")
    logging.getLogger('socketIO-client').setLevel(logging.DEBUG)
    logging.basicConfig()

socket.emit('initpython', 'ready');

print("setting up socket functions")
#setup socket functions
socket.on('connect', socket_connected )
socket.on('pyready', py_ready )
socket.on('pydata', on_recieve )
socket.wait(seconds=1)

def detect(img, cascade, offsettop, offsetbottom, offsetright, offsetleft):
    crop = []
    rects = cascade.detectMultiScale( #get face rects
        img,
        scaleFactor=1.1,
        minNeighbors=4,
        minSize=(30, 30),
        flags=cv2.CASCADE_SCALE_IMAGE)
    if len(rects) == 0:
        return [], []
    rects[:,2:] += rects[:,:2]

    for x, y, w, h in rects:
        crop.append(img[y-offsettop:y+w+offsetright, x+offsetleft:x+h+offsetright])
    return rects, crop

def detect_faces(img, cascade):
    cimg = img.copy(); #image to write stuff to

    faces = detect(img, cascade, 50, 0, 0, 0)
    draw_rects(cimg, faces, (0, 255, 0))
    return cimg

def draw_rects(img, rects, color):
    for x1, y1, x2, y2 in rects:
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)

def draw_text(img, text, x, y):
 cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_PLAIN, 1.5, (0, 255, 0), 2)

def prepare_training_data(data_folder_path,cascade):
    #------STEP-1--------
    #get the directories (one directory for each subject) in data folder
    dirs = os.listdir(data_folder_path)
    faces = []
    labels = []
    subjects = [""]
    for dir_name in dirs:
        if not dir_name.startswith("u"): #find folders that start with u
            continue;
        #------STEP-2--------
        #extract label number of subject from dir_name
        labl, subject = dir_name.split(',');
        subjects.append(subject)
        label = int(labl.replace("u", ""))
        #build path of directory containing images for current subject subject
        #sample subject_dir_path = "training-data/s1"
        subject_dir_path = data_folder_path + "/" + dir_name
         
        #get the images names that are inside the given subject directory
        subject_images_names = os.listdir(subject_dir_path)
     
        #------STEP-3--------
        #go through each image name, read image, detect face and add face to list of faces
        for image_name in subject_images_names:
            #ignore system files like .DS_Store
            if image_name.startswith("."):
                continue;
            #build image path
            image_path = subject_dir_path + "/" + image_name

            #read image
            image = cv2.imread(image_path)
            imagecp = image.copy()
             
            #detect face
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            facef, cropped = detect(gray, cascade, 50, 0, 0, 0)

            #display an image window to show the image
            #draw_rects(imagecp, facef, (0, 255, 0))
            #print("Len facef: "+str(len(facef)))
            #print("Len cropped: "+str(len(cropped)))
            if (len(cropped) == 0):
                print("Face at imgpath: "+image_path+" has no detected face. This will not be used in training data :(")
            else:
                #cv2.imshow("Training on image, SUBJECT: "+subject, cropped[0])
                #cv2.waitKey(1)
                for face in cropped: #if there is multiple faces then add all
                    cv2.resize(face,(250,250), interpolation = cv2.INTER_CUBIC) #resize to 250 by 250 image
                    #add face to list of faces
                    faces.append(face)
                    #add label for this face
                    labels.append(label)
                
    cv2.destroyAllWindows()
    cv2.waitKey(1)
    cv2.destroyAllWindows()
    return faces, labels, subjects

print("Preparing facial training data...")
faces, labels, subjects = prepare_training_data("/Users/Aaron/Desktop/Code/nodejs/index/python/opencv/training-data",faceCascade)
print("Data prepared")
 
#print total faces and labels
print("Total faces: ", len(faces))
print("Total labels: ", len(labels))
if (len(faces) == 0):
    print("WARNING: Why is faces 0? This will create an error probably, not training")
else:
    #Train face recognizer with training data
    print("Training facial recognizer with training data...")
    faceRecognizer.train(faces, np.array(labels))
    print("Facial recognizer trained.")
    print("Waiting for responses from client...")

running = True
while(running):
    for ev in socketin:
        command = ev[:1]
        argument = ev[2:]
        print ("EvQueue processing: "+command+" "+argument)
        if (command=="p"):
            pt+=argument
        elif (command=="q"):
            running = False
            print('Sending pydisconnect event...')
            #socket.emit('pydisconnect','')
        elif (command=="i"):
            pyimgnum = int(argument)
        elif (command=="o"):
            print("Opencv start")
            arg, key = argument.split(",")
            #read image real
            image = cv2.imread(str(arg));
            #image = cv2.imread("/Users/Aaron/Desktop/Code/nodejs/index/python/opencv/training-data/u1,Aaron/image0.png")
            if image is None:
                print("err, shape is none")
                socket.emit("GET", {"action": "login-opencvresponse", "data": {"imgnum": "error", "path": "error", "labels": [], "rects": [], "confidences": [], "key": key}}, sockcallback)
            else:
                print("Input image shape: "+str(image.shape))
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                gray = cv2.equalizeHist(gray)
                #detect faces
                facef, cropped = detect(gray, faceCascade, 50, 0, 0, 0)
                print ("Found "+str(len(facef))+" faces!")
                # Draw a rectangle around the faces
                i = 0
                ex_labels = ""
                ex_rects = ""
                ex_confidences = ""
                for x1, y1, x2, y2 in facef:
                    try:
                        label = faceRecognizer.predict(cropped[i]) #predict face
                    except:
                        label = ["RecognizerError"];
                        print("Face recognizer error :(")
                    print(str(label))
                    print("Face prediction: "+subjects[label[0]])
                    print("Confidence: "+str(label[1])+"%")
                    labeltxt = subjects[label[0]]
                    cv2.rectangle(image, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(image, labeltxt, (x1, y1-5), cv2.FONT_HERSHEY_PLAIN, 1.5, (0, 255, 0), 2)
                    ex_labels+=(","+labeltxt)
                    ex_rects+=",["+str(x1)+","+str(y1)+","+str(x2)+","+str(y2)+"]"
                    ex_confidences+=","+(str(label[1]))
                    i+=1
                #trim beginning comma
                ex_labels = ex_labels[1:]
                ex_rects = ex_rects[1:]
                ex_confidences = ex_confidences[1:]

                path = pyimgbasepath+"image"+str(pyimgnum)+".jpg"
                cv2.imwrite(path, image) #write the image
                socket.emit("GET", {"action": "login-opencvresponse", "data": {"imgnum": str(pyimgnum), "path": path, "labels": ex_labels, "rects": ex_rects, "confidences": ex_confidences, "key": key}}, sockcallback)
                #socket.emit("GET", {"action": "readback", "data": str(pyimgnum)+','+path}, sockcallback)
                pyimgnum+=1
        socketin.remove(ev)
    if (running==True):
        socket.wait(seconds=1)

print("Quitting...")