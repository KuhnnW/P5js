/////////////////////////ShikunWang_FOCUSING_GOldsmiths_MFA////////////////////////
///////////////// Interactive device using ml5js(poseNet) in P5js//////////////////
//////////////////////////////Project date August 2023/////////////////////////////
/*                                  statement
1, the development of this code is based on the ml5js posenet case code.         //
2, the code downloads the ml5js model to a local file package, so that it        //
can be run offline. If the code ml5js does not load properly, try opening        //
the index.html file again after networking.                                      //
3,This code is partially assisted by chatGPT.                                    //
*//////////////////////////////////////////////////////////////////////////////////

///////////////////////////        Global variables         ///////////////////////
let video;
let poseNet;
let poses = [];

//websockets
let serverAddresses = [
  'ws://192.168.8.228:81',//esp32 1
  'ws://192.168.8.147:81',//esp32 2
  'ws://192.168.8.229:81',//esp32 3
  'ws://192.168.8.112:81',//esp32 4
  'ws://192.168.8.227:81',//esp32 5
];
  // ... 
  // Add or remove according to the number of apertures actually used in the project
  // Sometimes the ip address of the esp32 will change, so change it in time.
  let sockets= [];


//Global variables about the posture recognition function
let lastSentTime = 0;

let lastPosition = null;  // Last recorded location
let stillCounter = 0;     // Counter, used to determine whether a person is stationary

//Global variables about the adjust area by lines
let segments = []; // 存储线段的x坐标
let selectedSegmentIndex = -1; // 当前被选中的线段的索引
let showSegments = true;


////////////////////////////////////       WebSocket       ///////////////////////////////
//Use forEach to iterate over each address, create a WebSocket connection for each address
//create event listeners for each connection.
function setupWebSocket() {
  serverAddresses.forEach(address => {
      let socket = new WebSocket(address);

      socket.onopen = function(event) {
          console.log(`Connected to ${address}`);
      };

      socket.onerror = function(error) {
          console.log(`Error with ${address}: ${error}`);
      };

      socket.onclose = function(event) {
          if (event.wasClean) {
              console.log(`The WebSocket connection to ${address} is closed.`);
          } else {
              console.log(`The WebSocket connection to ${address} is disconnected`);
          }
      };

      sockets.push(socket);
  });
}


////////////////////////////////////         setup         ///////////////////////////////
function setup() {
  // createCanvas(1280, 720);
  createCanvas(640, 480); //Create canvas size. Under test, 640,480 can get a better experience.
  video = createCapture(VIDEO); // Capture the video stream
  video.size(width, height);    // Set video size

  // Initialize PoseNet with single pose detection
  poseNet = ml5.poseNet(video, modelReady);

  
  
  // Listen to the 'pose' event for real-time updates

  poseNet.on('pose', function(results) {
    poses = results.slice(0, 3);
});


  // Hide the video element and show only the canvas
  video.hide();

  for (let i = 1; i <= 4; i++) {
    segments.push(width / 5 * i);
  }
  //Disable the browser's default right-click menu
  canvas.addEventListener('contextmenu', (e) => e.preventDefault()); 

}



function modelReady() {
  select('#status').html('Model Loaded'); // Update the status after the model is loaded
}

function draw() {
  image(video, 0, 0, width, height);

  // Set text properties for visibility
  fill(255);
  textSize(16);
  
  // Draw detected keypoints and skeleton
  drawKeypoints();
  drawSkeleton();

  // Display the number of people detected
  
  displayPeopleCount();

  // Estimate and display person's orientation
  displayOrientation();

  // Estimate and display upper body size
  displaySize();

  //Shows the distance between hands and heads
  displayHandToHeadDistances();

  checkIfStill();

  drawCanvasDivisions(); // 在每次画布更新时调用此函数以绘制红色线条


  
}

///////////////////// Function to draw detected keypoints/////////////////////////
function drawKeypoints() {
  // Traverse all detected gestures
  for (let i = 0; i < poses.length; i++) {
    let pose = poses[i].pose;
    for (let j = 0; j < pose.keypoints.length; j++) {
      let keypoint = pose.keypoints[j];
      if (keypoint.score > 0.2) {
        fill(255, 0, 0);
        noStroke();
        ellipse(keypoint.position.x, keypoint.position.y, 10, 10);// Draw key points
      }
    }
  }
}

// Function to draw the skeleton between keypoints
function drawSkeleton() {
  for (let i = 0; i < poses.length; i++) {
    let skeleton = poses[i].skeleton;
    for (let j = 0; j < skeleton.length; j++) {
      let partA = skeleton[j][0];
      let partB = skeleton[j][1];
      stroke(255, 0, 0);
      line(partA.position.x, partA.position.y, partB.position.x, partB.position.y);
    }
  }
}


/////////////////////////////////////////MoveorNot//////////////////////////////////
function checkIfStill() {
  if (poses.length === 1) {
    let pose = poses[0].pose;
    let currentNosePosition = pose.keypoints[0].position;

    if (lastPosition) {
      let distance = dist(lastPosition.x, lastPosition.y, currentNosePosition.x, currentNosePosition.y);
    
      // If the distance is less than 40 pixels, it indicates the person is relatively still
      // The 40 pixel range is proven to be a good parameter in 640 frames
      if (distance < 10) {
        stillCounter++;
      } else {
        stillCounter = 0;
      }
    }

    lastPosition = currentNosePosition;

    if (stillCounter > 200) {
      // 绘制红色的三角形在人的头部
      fill(255, 0, 0); // 设置为红色
      let triangleSize = 20; // 三角形的大小，可以根据需要调整
      triangle(
        currentNosePosition.x, currentNosePosition.y - triangleSize,
        currentNosePosition.x - triangleSize / 2, currentNosePosition.y + triangleSize / 2,
        currentNosePosition.x + triangleSize / 2, currentNosePosition.y + triangleSize / 2
      );

      if (Date.now() - lastSentTime > 6000) {  // 添加时间判断，每6秒发送一次
        sendOpenSignal();
        lastSentTime = Date.now();
      }
    }
  }
}





///////////////// Function to display the number of people detected/////////////////

let previousCount = 0; // Previous number
let countChangeFrames = 0; // The number of frames to record the number of people changing
const CHANGE_THRESHOLD = 15; // Set threshold

function displayPeopleCount() {
  let peopleCount = poses.length;

  fill(255);
  textSize(16);

  if (peopleCount === 2 && poses[1].pose.score < 0.9) {
    peopleCount = 1;
  }

 // If the current number of people is different from the previous number 
 // Reset the frame count counter
  if (poses.length !== previousCount) {
    countChangeFrames++;
  } else {
    countChangeFrames = 0; 
  }

  // If the number of people in consecutive CHANGE_THRESHOLD frames changes, 
  // update the number of people displayed
  if (countChangeFrames >= CHANGE_THRESHOLD) {
    previousCount = poses.length;
    countChangeFrames = 0;
  }

  text("Number of people: " + previousCount, 10, 20);
}



// Function to estimate and display the orientation of the person
function displayOrientation() {
  let orientation = detectOrientation();
  text("Orientation: " + orientation, 10, 40);
}

// Function to detect person's orientation based on visibility of face keypoints
function detectOrientation() {
  let faceKeypoints = [0, 1, 2, 3, 4]; // Indices for nose, leftEye, rightEye, leftEar, rightEar
  let threshold = 0.2; // Confidence threshold
  let visibleCount = 0;

  if (poses.length > 0) {
    let pose = poses[0].pose; // Assuming the first detected person
    for (let j = 0; j < faceKeypoints.length; j++) {
      let keypoint = pose.keypoints[faceKeypoints[j]];
      if (keypoint.score > threshold) {
        visibleCount++;
      }
    }
  }

  // Assuming that if more than 3 face keypoints are visible, the person is facing the camera
  return (visibleCount > 3) ? "front" : "back";
}




// Function to estimate and display the size of the upper body

function displaySize() {
  let size = estimateSize();
  if (size !== -1) {
    text("Estimated Size: " + size.toFixed(2) + " pixels", 10, 60);
  }
}

// Function to estimate size based on the distance from nose to hip
function estimateSize() {
  if (poses.length > 0) {
    let pose = poses[0].pose;
    let topKeyPoint = pose.keypoints[0]; // nose
    let bottomKeyPoint = pose.keypoints[11]; // left hip

    if (topKeyPoint.score > 0.2 && bottomKeyPoint.score > 0.2) {
      return abs(bottomKeyPoint.position.y - topKeyPoint.position.y);
    }
  }
  return -1;
}

function displayHandToHeadDistances() {
  for (let i = 0; i < poses.length; i++) {
    let pose = poses[i].pose;

    let nose = pose.keypoints[0];
    let leftWrist = pose.keypoints[9];
    let rightWrist = pose.keypoints[10];

    if (nose.score > 0.2 && leftWrist.score > 0.2) {
      let dLeft = dist(nose.position.x, nose.position.y, leftWrist.position.x, leftWrist.position.y);
      fill(255);
      textSize(16);
      text("Left Hand to Head Distance: " + Math.round(dLeft) + " px", 10, height - 30);
    }

    if (nose.score > 0.2 && rightWrist.score > 0.2) {
      let dRight = dist(nose.position.x, nose.position.y, rightWrist.position.x, rightWrist.position.y);
      fill(255);
      textSize(16);
      text("Right Hand to Head Distance: " + Math.round(dRight) + " px", 10, height - 10);
    }
  }
}





function getPersonPositionOnCanvas() {
  if (poses.length === 1) {
    let pose = poses[0].pose;
    let currentNosePosition = pose.keypoints[0].position;

    let segmentWidth = width / 5;

    // 根据鼻子的位置确定人体的方位
    if (currentNosePosition.x < segmentWidth) {
      return "far-left";
    } else if (currentNosePosition.x < 2 * segmentWidth) {
      return "left";
    } else if (currentNosePosition.x < 3 * segmentWidth) {
      return "center";
    } else if (currentNosePosition.x < 4 * segmentWidth) {
      return "right";
    } else {
      return "far-right";
    }
  } else {
    return "unknown";
  }
}







/////////////////////////adjust 5 area in space by mousepressed///////////////////////
function drawCanvasDivisions() {
  if (!showSegments) return; // 如果showSegments为false，则不绘制线条

  stroke(255, 0, 0);
  for (let i = 0; i < segments.length; i++) {
    line(segments[i], 0, segments[i], height);
  }
}

function mousePressed() {
  if (event.button === 2) { // 2 代表鼠标右键
    showSegments = !showSegments; // 切换showSegments的值
    redraw(); // 重新绘制画布
    return; // 避免进一步的处理
  }


  for (let i = 0; i < segments.length; i++) {
    if (abs(mouseX - segments[i]) < 5) { // 如果鼠标点击位置与线段距离小于5像素
      selectedSegmentIndex = i;
      break;
    }
  }
}

function mouseReleased() {
  selectedSegmentIndex = -1; // 释放选中线段
}

function mouseDragged() {
  if (selectedSegmentIndex !== -1) {
    segments[selectedSegmentIndex] = mouseX;
  }
}












/////////////////// Date send to Websockets//////////////////
// function sendOpenSignal() {
//   if(socket.readyState === WebSocket.OPEN) {
//     socket.send("open");
//     console.log("Sent 'open' to WebSocket");
//   }
// }
function sendOpenSignal() {
  sendSignalToAll("open");
}


function sendSignalToAll(signal) {
  sockets.forEach(socket => {
      if(socket.readyState === WebSocket.OPEN) {
          socket.send(signal);
          console.log(`Sent '${signal}' to WebSocket at ${socket.url}`);
      }
  });
}
