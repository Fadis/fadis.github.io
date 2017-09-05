(function() {
  'use strict';

  hterm.defaultStorage = new lib.Storage.Local();

  var device;

  let textEncoder = new TextEncoder();
  let t = new hterm.Terminal();
  t.onTerminalReady = () => {
    console.log('Terminal ready.');
    let io = t.io.push();
    io.onVTKeystroke = str => {
      if (device !== undefined) {
        device.transferOut(2, textEncoder.encode(str)).catch(error => {
          console.log('Send error: ' + error);
        });
      }
    };

    io.sendString = str => {
      if (device !== undefined) {
        device.transferOut(2, textEncoder.encode(str)).catch(error => {
          console.log('Send error: ' + error);
        });
      }
    };
  };

  document.addEventListener('DOMContentLoaded', event => {
    let connectButton = document.querySelector('#connect');

    t.decorate(document.querySelector('#terminal'));
    t.setWidth(80);
    t.setHeight(24);
    t.installKeyboard();

    function connect() {
      console.log('Connecting to ' + device.productName + '...');
      let readLoop = () => {
        if( device ) {
          device.transferIn(1, 64).then(result => {
            let textDecoder = new TextDecoder();
            t.io.print(textDecoder.decode(result.data));
            readLoop();
          }, error => {
            console.log( error );
          });
	}
      };
      return device.open().then(() => {
        if(device.configuration === null) {
          return device.selectConfiguration(1);
        }
      }).then(() => {
        return device.claimInterface(1);
      }).then(() => {
        return device.claimInterface(0);
      }).then(() => {
        return device.controlTransferOut({
          'requestType': 'class',
          'recipient': 'interface',
          'request': 0x22,
          'value': 0x01,
          'index': 0x00
        });
      }).then(() => {
        console.log('Connected.');
        connectButton.textContent = '切断';
	connectButton.disabled = false;
        readLoop();
      }, error => {
        port = undefined;
        connectButton.textContent = '接続';
	connectButton.disabled = false;
        console.log('Connection error: ' + error);
      });
    };
    connectButton.addEventListener('click', function() {
      connectButton.disabled = true;
      if ( device ) {
        device.controlTransferOut({
          'requestType': 'class',
          'recipient': 'interface',
          'request': 0x22,
          'value': 0x00,
          'index': 0x00
	}).then(() => {
	  device.close();
          connectButton.textContent = '接続';
	  connectButton.disabled = false;
	  device = undefined;
	});
      } else {
        const filters = [
          { 'vendorId': 0x2341, 'productId': 0x8036 },
          { 'vendorId': 0x2341, 'productId': 0x8037 },
        ];
        return navigator.usb.requestDevice({ 'filters': filters }).then(device_ => {
	  device = device_;
          connectButton.textContent = '接続中...';
          return connect();
        }).catch(error => {
          console.log('Connection error: ' + error);
          connectButton.textContent = '接続';
	  connectButton.disabled = false;
        });
      }
    });

    if( navigator.usb === undefined ) {
      t.io.println('This browser does not support WebUSB.');
      connectButton.disabled = true; 
    }
    else {
      navigator.usb.getDevices().then(devices => {
        if(devices.length == 0) {
          console.log('No devices found.');
        } else {
          connectButton.textContent = 'Connecting...';
          connectButton.disabled = true;
          device = devices[ 0 ];
          return connect();
        }
      }).catch(error => {
        console.log('Connection error: ' + error);
      });
    }
  });
})();
