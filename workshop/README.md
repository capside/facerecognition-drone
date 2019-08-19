# IoT facial recognition workshop (Raspberry Pi version)

This little workshop will show you how to use the [Azure IoT Edge](https://azure.microsoft.com/services/iot-edge/) technology, ensuring a safe connection between your devices and the cloud. Basically, you will create an [IoT Hub](https://azure.microsoft.com/services/iot-hub) to ingest iot telemetry and then you will deploy the [IoT Edge Agent](https://github.com/Azure/iotedge) on a device to run an [IoT Edge module](https://docs.microsoft.com/azure/marketplace/iot-edge-module).

There are two versions of the workshop: one [based on virtual machines](https://github.com/capside/facerecognition-drone/tree/workshop/workshop) and another one using [Raspberries](https://github.com/capside/facerecognition-drone/tree/raspberry/workshop).

The module is basically a web server with a web application implementing face recognition technology (with javascript!). 

You can of course clone the repo and [edit the proper code line](https://github.com/capside/facerecognition-drone/blob/f20be193900c3fa8395f275f93562cc64d8a0dd4/modules/FaceAPIServerModule/views/index.html#L402) to set your own photos :). 

After that just build the module using [the Dockerfile](https://github.com/capside/facerecognition-drone/blob/workshop/modules/FaceAPIServerModule/Dockerfile.amd64) and push it to your own [Docker Hub](https://hub.docker.com) repo. 

The last step is to modify the [deployment manifest](https://github.com/capside/facerecognition-drone/blob/26e455ea28d7ff758acf82e7634c46b62220300f/workshop/deployment.json#L40) with the name of your own image.

Even without that customization I think the tutorial is a nice and quick way to understand how Azure Iot Edge works. Feel free to write me at `email` at `javier-moreno.com` if you need help to set it up. 

Enjoy!

## Environment preparation

* Login into the [Azure portal](https://portal.azure.com)

* Open the cloudshell by clicking on the top bar `>_` icon and accept the creation of the *Storage Account* if needed

* Choose some nice names for your deployment

```bash
RESOURCE_GROUP_NAME=iotworkshop
IOT_HUB_NAME=<your very unique name>
DEVICE_NAME=<the name of your device>
```

## IotHub provisioning

* Create your resource group (if it does not exists) 

```bash
az group create --name $RESOURCE_GROUP_NAME --location westeurope
```

* Create the iot hub (remove `--sku S1` parameter if you want to use the free tier)

```bash
az extension add --name azure-cli-iot-ext
az iot hub create --resource-group $RESOURCE_GROUP_NAME --name $IOT_HUB_NAME --sku S1
az iot hub list --query "[].name"
```

## Device registration and creation

* Register a new shinny device (actually, right now, it's just a registered configuration in the *iot hub*)

```bash
az iot hub device-identity create --hub-name $IOT_HUB_NAME --device-id $DEVICE_NAME --edge-enabled
az iot hub device-identity list --hub-name $IOT_HUB_NAME

DEVICE_CONN_STRING=$(az iot hub device-identity show-connection-string --device-id $DEVICE_NAME --hub-name $IOT_HUB_NAME --query connectionString --output tsv)
echo $DEVICE_CONN_STRING
```

* **Take note of the connection string for later use**. No, REALLY, TAKE NOTE.

* Run next commands **in your raspi** to install the *edge agent*

```bash
sudo apt update
sudo apt install apt-transport-https ca-certificates curl software-properties-common -y
curl -sSL https://get.docker.com | sh
sudo apt install python-pip -y
sudo pip install azure-iot-edge-runtime-ctl
sudo apt-get remove unscd -y
sudo usermod -aG docker pi
```

## IotEdge runtime configuration

* Check if the tools are ready (if you need `sudo` to run `docker ps`, execute `sudo usermod -aG docker $(whoami)` and then logout and login again)

```
docker ps
sudo iotedgectl --version
```

* Init the device (replace the <...> with the actual device connection string, because you took note of it, isn't? ;-))
 
```bash
DEVICE_CONN_STRING="<device connection string>"
sudo iotedgectl setup --connection-string $DEVICE_CONN_STRING --nopass
```

* Start the device! (and see how the `dockerAgent` is already being deployed)

```bash
sudo iotedgectl start
docker ps
docker logs edgeAgent
```

## Deploying modules to the device

* Doublecheck you are again using your *cloudshell* session (not the raspberry) 

* Check it again

* Now deploy the modules on the device (actually, tell the *iothub* to ask the device to update its status) and open the port 3000 to access the webapp created by the deployment

```
wget https://raw.githubusercontent.com/capside/facerecognition-drone/raspberry/workshop/deployment.json
az iot edge set-modules --hub-name $IOT_HUB_NAME --device-id $DEVICE_NAME --content deployment.json
```

## Detecting the ~bad~ bald guys

* Monitor IotHub messages:

```bash
IOTHUB_CONN_STRING=$(az iot hub show-connection-string --name $IOT_HUB_NAME --query connectionString --output tsv)
echo $IOTHUB_CONN_STRING
az iot hub monitor-events --login $IOTHUB_CONN_STRING -y
```

* This is the moment: open the web application deployed on the device and look for the bald guy in the room

```bash
IP=<IP OF YOUR RASPI>
open http://$IP:3000
```

## Module configuration update with twins

* What about checking the *desired state* of your device? Run this command in your *cloudshell* session: 

```bash
az iot hub module-twin show --device-id $DEVICE_NAME --module-id FaceAPIServerModule --login "$IOTHUB_CONN_STRING" --resource-group $RESOURCE_GROUP_NAME
```

* And of course you can update that state easily (be careful with those quotes if you are using windows, use the commented version of the command):

```bash
az iot hub module-twin update --device-id $DEVICE_NAME --module-id FaceAPIServerModule --login "$IOTHUB_CONN_STRING" --resource-group $RESOURCE_GROUP_NAME --set properties.desired='{"apiKey":"12345", "sirenIP": "0.0.0.0"}'

# Windows version:
# az iot hub module-twin update --device-id pepsicola --module-id FaceAPIServerModule --login "HostName=ciberadoiothubdemo.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=WrRmz16n3Cqmg2UPx+ALhCE50ys7ZOFUwW0f7WKoicg=" --resource-group iotworkshop --set properties.desired="{\"apiKey\":\"12345\", \"sirenIP\": \"0.0.0.0\"}"

az iot hub module-twin show --device-id $DEVICE_NAME --module-id FaceAPIServerModule --login "$IOTHUB_CONN_STRING" --resource-group $RESOURCE_GROUP_NAME
```

## Cleanup

* Just delete the resource group

```bash
az group delete --name $RESOURCE_GROUP_NAME
```
