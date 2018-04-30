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

print ("init training")
print ("opencv version "+cv2.__version__)

pyimgbasepath = "/Users/Aaron/Desktop/Code/nodejs/index/tmpimgs/out/"
pyimgnum = 0

#OpenCv face cascade
faceCascade = cv2.CascadeClassifier("/Users/Aaron/Desktop/Code/nodejs/index/python/opencv/haarcascade_frontalface_default.xml")
#OpenCv face recognizer
faceRecognizer = cv2.face.LBPHFaceRecognizer_create()
#window for displaying stuff
cv2.namedWindow('training', cv2.WINDOW_NORMAL)
#cv2.resizeWindow('training', 360, 640)
#create trackbars for offset
def nothing(x):
    print("nothing recv"+str(x))
    pass
cv2.createTrackbar('TopOffset','training',-200,200,nothing)
cv2.createTrackbar('BottomOffset','training',-200,200,nothing)
cv2.createTrackbar('RightOffset','training',-200,200,nothing)
cv2.createTrackbar('LeftOffset','training',-200,200,nothing)
#camera capture
capture = cv2.VideoCapture(0)

def detect(img, cascade, offsettop, offsetbottom, offsetright, offsetleft):
    crop = []
    rects = cascade.detectMultiScale( #get face rects
        img,
        scaleFactor=1.3,
        minNeighbors=7,
        minSize=(30, 30),
        flags=cv2.CASCADE_SCALE_IMAGE)
    if len(rects) == 0:
        return [], []
    rects[:,2:] += rects[:,:2]

    for x, y, w, h in rects:
        #x+=cv2.getTrackbarPos('LeftOffset','training')
        #w+=cv2.getTrackbarPos('RightOffset','training')
        #y+=cv2.getTrackbarPos('TopOffset','training')
        #h+=cv2.getTrackbarPos('BottomOffset','training')
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

 
def Distance(p1,p2):
  dx = p2[0] - p1[0]
  dy = p2[1] - p1[1]
  return math.sqrt(dx*dx+dy*dy)

def ScaleRotateTranslate(image, angle, center = None, new_center = None, scale = None, resample=Image.BICUBIC):
  if (scale is None) and (center is None):
    return image.rotate(angle=angle, resample=resample)
  nx,ny = x,y = center
  sx=sy=1.0
  if new_center:
    (nx,ny) = new_center
  if scale:
    (sx,sy) = (scale, scale)
  cosine = math.cos(angle)
  sine = math.sin(angle)
  a = cosine/sx
  b = sine/sx
  c = x-nx*a-ny*b
  d = -sine/sy
  e = cosine/sy
  f = y-nx*d-ny*e
  return image.transform(image.size, Image.AFFINE, (a,b,c,d,e,f), resample=resample)

def CropFace(image, eye_left=(0,0), eye_right=(0,0), offset_pct=(0.2,0.2), dest_sz = (70,70)):
  # calculate offsets in original image
  offset_h = math.floor(float(offset_pct[0])*dest_sz[0])
  offset_v = math.floor(float(offset_pct[1])*dest_sz[1])
  # get the direction
  eye_direction = (eye_right[0] - eye_left[0], eye_right[1] - eye_left[1])
  # calc rotation angle in radians
  rotation = -math.atan2(float(eye_direction[1]),float(eye_direction[0]))
  # distance between them
  dist = Distance(eye_left, eye_right)
  # calculate the reference eye-width
  reference = dest_sz[0] - 2.0*offset_h
  # scale factor
  scale = float(dist)/float(reference)
  # rotate original around the left eye
  image = ScaleRotateTranslate(image, center=eye_left, angle=rotation)
  # crop the rotated image
  crop_xy = (eye_left[0] - scale*offset_h, eye_left[1] - scale*offset_v)
  crop_size = (dest_sz[0]*scale, dest_sz[1]*scale)
  image = image.crop((int(crop_xy[0]), int(crop_xy[1]), int(crop_xy[0]+crop_size[0]), int(crop_xy[1]+crop_size[1])))
  # resize it
  image = image.resize(dest_sz, Image.ANTIALIAS)
  return image

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
            draw_rects(imagecp, facef, (0, 255, 0))
            #print("Len facef: "+str(len(facef)))
            #print("Len cropped: "+str(len(cropped)))
            if (len(cropped) == 0):
                print("Face at imgpath: "+image_path+" has no detected face. This will not be used in training data :(")
            else:
                cv2.imshow("Training on image, SUBJECT: "+subject, cropped[0])
                cv2.waitKey(1)
                for face in cropped: #if there is multiple faces then add all
                    #add face to list of faces
                    faces.append(face)
                    #add label for this face
                    labels.append(label)
                
    cv2.destroyAllWindows()
    cv2.waitKey(100)
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
    print("Waiting to recognize face...")

running = True
while(running):
    ret, image = capture.read()
    print("Input image shape: "+str(image.shape))
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    #detect faces
    facef, cropped = detect(gray, faceCascade, 60, 50, -90, 0)
    print ("Found "+str(len(facef))+" faces!")
    # Draw a rectangle around the faces
    try:
        i = 0
        for x1, y1, x2, y2 in facef:
            label = faceRecognizer.predict(cropped[i]) #predict face
            print(str(label))
            print("Face prediction: "+subjects[label[0]])
            print("Confidence: "+str(label[1])+"%")
            labeltxt = subjects[label[0]]
            cv2.rectangle(image, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(image, labeltxt, (x1, y1-5), cv2.FONT_HERSHEY_PLAIN, 1.5, (0, 255, 0), 2)
            cv2.putText(image, str(round(label[1])), (x1, y1-20), cv2.FONT_HERSHEY_PLAIN, 1.5, (0, 255, 0), 2)
            i+=1
    except:
        print("uh wat an error occurred in calculate")
    try:
        if (len(cropped) == 0):
            print("cropped len 0, no face detected")
        else:
            cv2.resize(image, (0,0), fx=0.25, fy=0.25)
            cv2.imshow("training", image)
            def keywait():
                
                key=cv2.waitKey(0) & 0xFF
                key=ord(key)
                keys = {
                    1: "k",
                    2: "s",
                    3: "q",
                }
                press=keys.get(key, None) #filter through list
                return press
            press=keywait()
            if (press == None):
                print("invalid key")
                keywait()
            else:
                if (press == "k"):
                    print("bad image")
                elif (press == "s"):
                    print("saving image")
                elif (press == "q"):
                    print("quitting")
                    cv2.destroyAllWindows()
                    running = False;
                else:
                    print("invalid key 2 (shouldnt happen)")

    except:
        print("O no another error occured in imshow")
print("TERM signal sent, exiting")
cv2.destroyAllWindows()
