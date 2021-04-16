//'use strict';

var webcamElement  = document.getElementById('webcam');
var videoSelect    = document.querySelector('select#videoSource');
var canvas         = document.getElementById("canvas");
var mini_canvas    = document.getElementById("mini_canvas");
var ai_canvas      = document.getElementById("ai_canvas");

var ctx            = canvas.getContext('2d');
var mini_ctx       = mini_canvas.getContext('2d');
var ai_ctx         = ai_canvas.getContext('2d');

var pred_hours = 0;
var pred_minutes = 0;



var clock_model = null;
videoSelect.onchange = getStream;

function extractTimeFromImage() {

    tf.engine().startScope(); // Ensure tensors are disposed of ( memory leak prevention)

    canvas.width  = webcamElement.videoWidth;
    canvas.height = webcamElement.videoHeight;

    var capture_width = 180;
    var capture_height = 180;
    var pX=canvas.width/2  - capture_width/2;
    var pY=canvas.height/2 - capture_height/2;

    ctx.drawImage(webcamElement, 0, 0, canvas.width, canvas.height );
    mini_canvas.width  = 144;
    mini_canvas.height = 144;
    mini_ctx.drawImage(canvas,  pX, pY, capture_width, capture_height, 0, 0, capture_width, capture_height  );

    var image = tf.browser.fromPixels( mini_canvas, 3 ).toFloat() //mean(2)//.toFloat()

    input_height = 144
    input_width  = 144
    image = image.resizeBilinear([input_width, input_height])

    image = image.mean(2)

    ai_canvas.width = capture_width;
    ai_canvas.height = capture_width;

    image = image.div(255.0)
    //image = tf.stack( [ image, image, image ], 2)

    if ( clock_model != null ) {
      image =image.expandDims(0);
      image =image.expandDims(3);

      result = clock_model.predict( image, { batch_size:1});
      result = result.dataSync();

      ha  =  Math.atan2(  ( result[0]*1.01), ( result[1]*1.01) );
      ma  =  Math.atan2(  ( result[2]*1.01), ( result[3]*1.01) );

      ha  = ha*180;
      ma  = ma*180;

      ha  = ha/Math.PI;
      ma  = ma/Math.PI;

      if ( ha < 0 ) {
          ha = ha + 360;
      }

      if ( ma < 0 ) {
          ma = ma + 360;
      }

      new_pred_hours   = Math.floor(ha/30)
      new_pred_minutes = Math.floor( ( ha - ( new_pred_hours*30) )/2 )

      console.log(  ha/30, new_pred_hours, new_pred_minutes  )

      new_pred_minutes_approx = Math.floor(ma/6);

      console.log( new_pred_hours, new_pred_minutes_approx );


      if ( ( new_pred_minutes_approx > 56 ) && ( new_pred_minutes > 56) ) {
          new_pred_minutes = new_pred_minutes_approx;
      }
      else if ( ( new_pred_minutes_approx < 4) && ( new_pred_minutes < 4 ) ) {
          new_pred_minutes = new_pred_minutes_approx;
      }
      else if (  ( new_pred_minutes_approx > 3 && new_pred_minutes_approx < 57) && ( new_pred_minutes > 3 && new_pred_minutes < 57) ) {
          new_pred_minutes = new_pred_minutes_approx;
      }
      else if (  new_pred_minutes > 0 && new_pred_minutes <  30 && new_pred_minutes_approx > 50 ) {
          new_pred_minutes = new_pred_minutes_approx;
      }

      pred_hours   = new_pred_hours;
      pred_minutes = new_pred_minutes;

    } else {
      console.log("No result")
    }

    ctx.lineWidth = "3";
    ctx.strokeStyle = "red";

    // Clock target image
    ctx.beginPath();
    ctx.arc(pX+capture_width/2, pY+capture_height/2, capture_width/2, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pX+capture_width/2, pY+capture_height/2);
    ctx.lineTo(pX+capture_width/2 + 100, pY+capture_height/2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pX+capture_width/2, pY+capture_height/2);
    ctx.lineTo(pX+capture_width/2 - 100, pY+capture_height/2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pX+capture_width/2, pY+capture_height/2);
    ctx.lineTo(pX+capture_width/2, pY+capture_height/2 + 100);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pX+capture_width/2, pY+capture_height/2);
    ctx.lineTo(pX+capture_width/2, pY+capture_height/2 - 100);
    ctx.stroke();

    ctx.font = "50px Arial";
    var text = " Time:- " + (  pred_hours.toString()).padStart(2, '0') + ":" + (  pred_minutes.toString()).padStart(2, '0');
    ctx.fillText( text,200, 40);
    //
    var timeElement    = document.getElementById("time");
    timeElement.innerHTML = text;

    tf.engine().endScope(); // Prevent memory leak

    setTimeout( extractTimeFromImage , 500);
}

function getDevices() {
  return navigator.mediaDevices.enumerateDevices();
}

function gotDevices(deviceInfos) {
  console.log('Got Devices ');
  window.deviceInfos = deviceInfos; // make available to console

  for (const deviceInfo of deviceInfos) {
    const option = document.createElement('option');
    console.log( deviceInfo );
    if (deviceInfo.kind === 'videoinput') {
      option.value = deviceInfo.deviceId;
      console.log(" Source  ", deviceInfo.deviceId );
      console.log(" Source  ", deviceInfo );
      console.log(" Source  ", deviceInfo.label );
      option.text = deviceInfo.label || `Camera ${videoSelect.length + 1}`;
      videoSelect.appendChild(option);
    }
  }
}

function gotStream( stream ) {
  console.log('Got stream ');
  window.stream = stream;
  console.log("Selected items");
  console.log(videoSelect.options);
  videoSelect.selectedIndex = [ ...videoSelect.options].findIndex(option => option.text == stream.getVideoTracks()[0].label);
  webcamElement.srcObject = stream;
}

function getStream() {
  if (window.stream) {
    window.stream.getTracks().forEach(track => {
      track.stop();
    });
  }
  const videoSource = videoSelect.value;
  const constraints = {
      video: {deviceId: videoSource ? {exact: videoSource} : undefined}
  };
  return navigator.mediaDevices.getUserMedia(constraints).then(gotStream).catch(handleError);
}

function handleError(error) {
  console.log('Error: ', error);
}

async function app() {
  // Get video stream
  getStream().then(getDevices).then(gotDevices);
  // Load model
  // tf.loadGraphModel('robust_model2/json/model.json').then(function(model) {
  //tf.loadGraphModel('test/model.json').then(function(model) {
  tf.loadGraphModel('raw/model.json').then(function(model) {
    clock_model = model;
  });

  var video =  webcamElement
   video.onplay = function() {
    // Timer to Extract time from image
    setTimeout( extractTimeFromImage , 500);
   };
}

app();
