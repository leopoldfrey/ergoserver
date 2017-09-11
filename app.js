var express     = require("express");
var http       = require("http");
var multer      = require("multer");
var fs          = require("fs");
//var WebSocket   = require("ws");
var WebSocket   = require("ws");
var WebSocketServer   = WebSocket.Server;
var bodyParser  = require("body-parser");
//var OSC         = require('osc-js') 
// var osc = require("osc");

var app         =   express();
var server = http.createServer(app);


/* PARAMETERS */
var webServerPort = 8080; // Web server (http) listens on this port
var webSocketServerPort = 8000; // Web socket for changing protocols
// var oSCServerPort = 8082; // OSC Server listents on this port

// var oSCSendAddress = "127.0.0.1"; // OCS messages are sent to this address
// var oSCSendPort = 1234;  // OCS messages are sent to this port

app.get('/',function(req,res){
      res.sendFile(__dirname + "/public/index.html");
});

app.get('/ergoconf.html',function(req,res){
      res.sendFile(__dirname + "/public/ergoconf.html");
});

app.get('/ergocontroller.html',function(req,res){
      res.sendFile(__dirname + "/public/ergocontroller.html");
});


/*----------- Static Files -----------*/
app.use('/vendor', express.static('public/vendor'));
app.use('/css', express.static('public/css'));
app.use('/js', express.static('public/js'));
app.use('/img', express.static('public/img'));

app.use('/uploads', express.static('uploads'));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

server.listen(webServerPort,function() {
    console.log("Web Server listening port " + webServerPort);
});
/*----------- Static Files -----------*/


/*----------- OSC Sender -----------*/
// var oscPort = new osc.WebSocketPort({
//     url: "ws://localhost:8081" // URL to your Web Socket server. 
// });
/*----------- OSC Sender -----------*/

// Create an osc.js UDP Port listening on port 8082
// var udpPort = new osc.UDPPort({
//     localAddress: "0.0.0.0",
//     localPort: oSCServerPort
// });

// Open the socket.
// udpPort.open();

// When the port is read, send an OSC message to test
// udpPort.on("ready", function () {
//   console.log("OSC server runing on port " + oSCServerPort);

//   // Send a test message
//   udpPort.send({
//       address: "/test",
//       args: ["msg", "hello"]
//   }, oSCSendAddress, oSCSendPort);

// });

/*----------- OSC Sender -----------*/


/*----------- Img receive -----------*/
/*
var upload = multer({ dest: 'upload/'});
var type = upload.single('ergoimage');


app.post('/image', type, function (req,res) {

  // When using the "single" data come in "req.file" regardless of the attribute "name".
  var tmp_path = req.file.path;

  // The original name of the uploaded file stored in the variable "originalname".
  var target_path = 'uploads/' + req.file.originalname;

  // A better way to copy the uploaded file.
  var src = fs.createReadStream(tmp_path);
  var dest = fs.createWriteStream(target_path);
  src.pipe(dest);
  src.on('end', function() { res.render('complete'); });
  src.on('error', function(err) { res.render('error'); });

});
*/


var upload = multer({ dest: '/tmp' })

app.post('/image', upload.single("ergoimage"), function (req, res) {
   console.log("Receiving image..");
   var date = new Date();

   var stringToAppend = date.getHours() + "h" + date.getMinutes() + "m" +  date.getSeconds() + "s" + date.getMilliseconds();

   var file = __dirname + "/uploads/" + stringToAppend + "_" +  req.file.originalname;
   fs.readFile( req.file.path, function (err, data) {
        fs.writeFile(file, data, function (err) {
         if( err ){
              console.error( err );
              response = {
                   message: 'Sorry, file could not be uploaded.',
                   filename: req.file.originalname
              };
         }else{
               console.log("Image saved");
               response = {
                   message: 'File uploaded successfully',
                   filename: req.file.originalname
              };

              // Notify OSC server about image
              // udpPort.send({
              //     address: "/new_img",
              //     args: ["filename", file]
              // }, oSCSendAddress, oSCSendPort);


          }
          res.end( JSON.stringify( response ) );
       });
   });
});


/*

var storage =   multer.diskStorage({
  destination: function (req, file, callback) {
    console.log("Destinatio callback");
    callback(null, './uploads');
  },
  filename: function (req, file, callback) {
    console.log("Filename callback");
    callback(null, file.fieldname + '-' + Date.now());
  }
});

var upload = multer({ storage : storage}).single('ergoimage');

app.post('/image',function(req, res){

    //console.log("*********Post received: req********");
    //console.log(req);
    //console.log("*********Post received: res*********");
    //console.log(res);
    upload(req,res,function(err) {
        if(err) {
            console.log("Error: " + err);
            return res.end("Error uploading file.");
        }
        console.log("File is uploaded");
        res.end("File is uploaded");
    });
});
*/
/*----------- Img receive -----------*/


/*----------- Mail receive -----------*/
// https://codeforgeek.com/2014/09/handle-get-post-request-express-4/
app.post('/mail', function (req, res) {
  console.log("Receiving e-mail..");

  var file = __dirname + "/uploads/mails.txt";

  if (req.body.mail) {
    fs.appendFile(file, req.body.mail + "\r\n", function (err) {
      if (err) {
        console.log("Error saving e-mail on file");
      } else {
        console.log('E-mail saved');
      }
    });
  } else {
    console.log("Error: e-mail received invalid");  
  }
  
  res.end("ok");
})
/*----------- Mail receive -----------*/


/*----------- WS Server -----------*/

// const wss = new WebSocket.Server({ port: webSocketServerPort },function(){
//   console.log("WS Server listenting on " + webSocketServerPort);
// });


const wss = new WebSocketServer({
    server: server,
    autoAcceptConnections: true
});

var currentStage = 0;
var currentStandbyMessage = "FOCUS ON THE CONFERENCE";

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    console.log('Received: %s', message);

    var msg = JSON.parse(message);
    
    switch(msg.type) {
      case "broadcast":
        currentStage = msg.stage;
        currentStandbyMessage = msg.standbyMsg;

        wss.clients.forEach(function each(client) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            console.log("Sending: " + currentStage);
            client.send(
              JSON.stringify(
              {
                type: "",
                stage: currentStage,
                standbyMsg: currentStandbyMessage
              }));
          }
        });

      break;

      case "getInit":
        // Reply with state
        console.log("Replying with: " + currentStage);
        this.send( 
        JSON.stringify(
        {
          type: "initState",
          stage: currentStage,
          standbyMsg: currentStandbyMessage
        }));

      break;
    }



  });

  //ws.send('something');
});
/*----------- WS Server -----------*/


/*----------- OSC Server -----------*/
/*
const plugin = new OSC.WebsocketServerPlugin({ port: 8082 });
const osc = new OSC({ plugin: plugin });
 
osc.on('/test', (message) => {
  console.log(message.args);
})


osc.on('open', () => {
  console.log("OSC open on port 8082");
})

osc.on('close', () => {
  // connection was closed
  console.log("OSC closed");
});

osc.on('error', (err) => {
  console.log("OSC error");
});

osc.open({ port: 8082 }); // start server
*/


 /*
osc.on(['param', 'volume'], (message) => {
  console.log(message.args)
})
 
osc.on('open', () => {
  const message = new OSC.Message('/test', 12.221, 'hello')
  osc.send(message)
 
  const bundle = new OSC.Bundle(Date.now() + 5000)
  bundle.add(message)
  osc.send(bundle, { host: '192.168.178.5' })
})
 */
 /*
osc.open({ port: 8082 }, function(){
  console.log("OSC on port 8082");
});
*/

/*----------- OSC Server -----------*/

