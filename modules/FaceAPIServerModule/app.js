'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const Protocol = require('azure-iot-device-mqtt').Mqtt;
const Client = require('azure-iot-device').ModuleClient;
const Message = require('azure-iot-device').Message;
const express = require('express');
const path = require('path');

let sirenIP = '192.168.1.216';
let apiKey = '2C3D2ADF6F408AA7';
let iotEdgeHubClient;

function startIotEdgeHubClient() {
  Client.fromEnvironment(Protocol, function (err, client) {
    if (err) {
      throw err;
    } else {
      client.on('error', function (err) {
        throw err;
      });
  
      console.log(`Connecting to IoTHub.`);
      client.open(function (err) {
        if (err) {
          throw err;
        } else {
          console.log('IoT Hub module client initialized');
          iotEdgeHubClient = client;
          client.on('inputMessage', onInputMessage);
          client.onMethod('SetVisualAlarmState', onDirectMethodSetVisualAlarmState);

          console.log(`Configuring module twin handlers.`);
          client.getTwin((err, twin) => {
            if (err) {
              console.error(JSON.stringify(err));
            } else {
              twin.on('properties.desired', updateModuleConfiguration);
              console.log(`Module twin handlers configured.`);
            }
          });   

          updateModuleConfiguration();
          startExpressServer();
        }
      });
    }
  });  
}

function updateModuleConfiguration(delta) {
  console.log(`Module twin modified properties: ${JSON.stringify(delta)}.`);
  if (delta && delta.sirenIP) sirenIP = delta.sirenIP;
  if (delta && delta.apiKey) apiKey = delta.apiKey;
}

function onInputMessage(inputName, msg) {
  console.log(`Received message ${JSON.stringify(msg)}.`);
  /* this points to iotEdgeHubClient */
  this.complete(msg, function(err, data) {});
}

function onDirectMethodSetVisualAlarmState(request, response) {
  // Example payload: { "desiredAlarmState" : true }
  console.log(`SetVisualAlarmState: ${JSON.stringify(request.payload)}.`);
  const desiredAlarmState = request.payload.desiredAlarmState ? 1 : 0;
  const requestOptions = {
    host: sirenIP,
    port: 80,
    path: `/api/relay/0?apikey=${apiKey}&value=${desiredAlarmState}`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }    
  };
  console.log(`Changing alarm state: ${requestOptions.host + requestOptions.path}.`)
  
  http.request(requestOptions, function(res) {
    console.log('STATUS: ' + res.statusCode);
    console.log('HEADERS: ' + JSON.stringify(res.headers));
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      console.log('BODY: ' + chunk);
    });
  }).end();

  response.send(200, 'SetVisualAlarmState invoked: ' + JSON.stringify(request.payload), function(err) {
    if (err) {
      console.log(`Direct method invocation failed: ${JSON.stringify(err)}.`);
      return;
    }
    console.log(`Direct method invocation completed.`);
  });
}

function pipeMessage(client, inputName, messagePayload) {
  if (inputName === 'express') {
    messagePayload.timestamp = new Date().getTime();
    const message = new Message(JSON.stringify(messagePayload));
    message.properties.add('MessageType', 'face-match');
    client.sendOutputEvent('output1', message, function(err, data) {
      if (err) throw err;
      console.log(`Message sent (${JSON.stringify(data).substring(0,80)}...).`);
    });
  }
}

function startExpressServer() {
  const app = express()

  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  
  const viewsDir = path.join(__dirname, 'views')
  app.use(express.static(viewsDir))
  app.use(express.static(path.join(__dirname, './public')))
  app.use(express.static(path.join(__dirname, './weights')))
  app.use(express.static(path.join(__dirname, './dist')))
  
  app.get('/', (req, res) => res.sendFile(path.join(viewsDir, 'index.html')))
  app.post('/', async (req, res) => {
    if (iotEdgeHubClient) pipeMessage(iotEdgeHubClient, 'express', req.body);
    return res.status(200).send('Received match.');
  });

  const options = {
		key: fs.readFileSync( './server.key' ),
		cert: fs.readFileSync( './server.cert' ),
		requestCert: false,
		rejectUnauthorized: false
  };
  const server = https.createServer(options, app);
  server.listen(3000,  function () {
    console.log( 'Express server listening on port ' + server.address().port );
  });
}

//startExpressServer();
startIotEdgeHubClient();
