(function() {
  'use strict';

  var device;

  let textEncoder = new TextEncoder();
  let t = new Terminal();
  let writing = false;
  let buffer = '';

  function flush() {
    writing = true;
    let buffer_ = buffer;
    buffer = '';
    device.transferOut(2, textEncoder.encode(buffer_)).then(result => {
      writing = false;
      if( buffer.length != 0 ) {
        flush();
      }
    }).catch(error => {
      console.log('送信エラー: ' + error);
      writing = false;
      if( buffer.length != 0 ) {
        flush();
      }
    });
  }

  t.open( document.getElementById('terminal') );
  t.on('key', function (key, ev) {
    if (device !== undefined) {
      if( !writing ) {
        buffer += key;
        flush();
      }
      else {
        buffer += key;
      }
    }
  });

  t.on('paste', function (data, ev) {
    if (device !== undefined) {
      device.transferOut(2, textEncoder.encode(data)).catch(error => {
        console.log('送信エラー: ' + error);
      });
    }
  });

  document.addEventListener('DOMContentLoaded', event => {
    let connectButton = document.querySelector('#connect');
    function connect() {
      console.log('デバイス ' + device.productName + ' に接続中...');
      let readLoop = () => {
        if( device ) {
          device.transferIn(1, 1024).then(result => {
            let textDecoder = new TextDecoder();
            t.write(textDecoder.decode(result.data));
            readLoop();
          }, error => {
            console.log( error );
            readLoop();
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
        console.log('接続中');
        connectButton.textContent = '切断';
	connectButton.disabled = false;
        readLoop();
      }, error => {
        port = undefined;
        connectButton.textContent = '接続';
	connectButton.disabled = false;
        console.log('接続エラー: ' + error);
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
        let vendor_id = document.getElementById('vendor').value;
        let product_id = document.getElementById('product').value;
        const filters = [
          { 'vendorId': vendor_id, 'productId': product_id },
        ];
        return navigator.usb.requestDevice({ 'filters': filters }).then(device_ => {
	  device = device_;
          connectButton.textContent = '接続中';
          return connect();
        }).catch(error => {
          console.log('接続エラー: ' + error);
          connectButton.textContent = '接続';
	  connectButton.disabled = false;
        });
      }
    });

    if( navigator.usb === undefined ) {
      t.writeln('このブラウザはWebUSBをサポートしていません');
      connectButton.disabled = true; 
    }
    else {
      navigator.usb.getDevices().then(devices => {
        if(devices.length == 0) {
          console.log('デバイスが見つかりません');
        } else {
          connectButton.textContent = '接続中';
          connectButton.disabled = true;
          device = devices[ 0 ];
          return connect();
        }
      }).catch(error => {
        console.log('接続エラー: ' + error);
      });
    }
  });
})();
