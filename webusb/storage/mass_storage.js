(function() {
  'use strict';

  var device;

  var mass_storage;

  var sector_size = 512;

  let textEncoder = new TextEncoder();
  let t = new Terminal();
  
  t.open( document.getElementById('terminal') );
  t.on('key', function (key, ev) {
  });

  t.on('paste', function (data, ev) {
  });

  let rahex2 = num => {
    let serialized = '';
    if( num < 0x10 ) serialized += '0';
    if( num < 0x100 ) serialized += '0';
    if( num < 0x1000 ) serialized += '0';
    serialized += num.toString( 16 );
    return serialized;
  }
  let rahex1 = num => {
    let serialized = '';
    if( num < 0x10 ) serialized += '0';
    serialized += num.toString( 16 );
    return serialized;
  }
  let radec1 = num => {
    let serialized = '';
    if( num < 10 ) serialized += '0';
    serialized += num.toString( 10 );
    return serialized;
  }

  let hex_dump = data => {
    let offset = 0;
    let serialized = rahex2( offset ) + '  ';
    for( offset = 0; offset != data.byteLength; ++offset ) {
      if( offset != 0 && ( offset % 16 ) == 0 ) {
        serialized += '\n\r' + rahex2( offset ) + '  ';
      }
      let value = data.getUint8( offset );
      serialized += rahex1( value ) + ' ';
    }
    return serialized + '\n\r';
  };

  let parse_partition_table = data => {
    let partition_table_offset = 446;
    let table = [];
    for( let i = 0; i != 4; ++i ) {
      table.push({
        'type': data.getUint8( partition_table_offset + i * 16 + 4 ),
	'at': data.getUint32( partition_table_offset + i * 16 + 8, true ),
	'length': data.getUint32( partition_table_offset + i * 16 + 12, true )
      });
    }
    return table;
  }

  function async_sleep( msec ) {
    return new Promise( resolve => setTimeout( resolve, msec ) );
  }

  document.addEventListener('DOMContentLoaded', event => {
    let connectButton = document.querySelector('#connect');
    function connect() {
      console.log('デバイス ' + device.productName + ' に接続中...');
      let cbw = ( tag, len, dir, command ) => {
	let data = new Uint8Array( 15 + 16 );
	data.set([
	  0x55, 0x53, 0x42, 0x43, // USBC
	  tag & 0xFF, ( tag >> 8 ) & 0xFF, ( tag >> 16 ) & 0xFF, ( tag >> 24 ) & 0xFF, // tag
	  len & 0xFF, ( len >> 8 ) & 0xFF, ( len >> 16 ) & 0xFF, ( len >> 24 ) & 0xFF, // len
          dir << 7, // flags
          0, // LUN
	  command.byteLength // command length
	], 0);
	data.set( command, 15 );
	return device.transferOut( 2, data );
      }
      let csw = () => {
        return device.transferIn( 1, 13 ).then( result => {
	  let state = result.data.getUint8( 12 );
	  return state == 0;
	});
      }
      let inquiry = () => {
        let command = new Uint8Array([
	  0x12, // INQUIRY
	  0, // LUN
	  0, 0, // reserved
	  0x24, // data size
	  0 // reserved
	]);
        return cbw( 1, 36, 1, command ).then( result => {
	  return device.transferIn( 1, 36 )
	}).then( result => {
	  let vender_id='';
	  let product_id='';
	  let revision='';
	  let i;
	  for( i = 8; i != 16; i++ ) {
	    vender_id += rahex1( result.data.getUint8( i ) );
	  }
	  for( i = 16; i != 31; i++ ) {
	    product_id += rahex1( result.data.getUint8( i ) );
	  }
	  for( i = 32; i != 36; i++ ) {
	    revision += rahex1( result.data.getUint8( i ) );
	  }
	  console.log( 'VenderID: ' + vender_id );
	  console.log( 'ProductID: ' + product_id );
	  console.log( 'Revision: ' + revision );
	  return { 'vender_id': vender_id, 'product_id': product_id, 'revision': revision };
	}).then( data => {
	  return csw().then( stat => {
	    return { 'status': stat, 'data': data }
	  });
	});
      }
      let test_unit_ready = () => {
        let command = new Uint8Array([
	  0x00, // INQUIRY
	  0 // LUN
	]);
        return cbw( 1, 0, 1, command ).then( result => {
	  return csw();
	}).then( stat => {
	  if( stat ) {
	    console.log( 'デバイスが利用可能になりました' );
	    return true;
	  }
          else {
	    console.log( 'デバイスが利用可能になるのを待っています' );
	    return async_sleep( 1000 ).then( test_unit_ready );
	  }
	});
      }
      let read_capacity = () => {
        let command = new Uint8Array([
	  0x25, // INQUIRY
	  0 // LUN
	]);
        return cbw( 1, 8, 1, command ).then( result => {
	  return device.transferIn( 1, 8 )
	}).then( result => {
	  let last_logical_block_address = result.data.getUint32( 0 );
	  let block_length = result.data.getUint32( 4 );
	  sector_size = block_length;
	  console.log( 'Last Logical Block Address: ' + last_logical_block_address.toString(10) );
	  console.log( 'Block Length: ' + block_length.toString(10) );
	  console.log( 'Capacity: ' + ( ( last_logical_block_address / 1024 / 1024 ) * block_length ).toString(10) + 'MB' );
	  return { 'last_logical_block_address': last_logical_block_address, 'block_length': block_length };
	}).then( data => {
	  return csw().then( stat => {
	    return { 'status': stat, 'data': data }
	  });
	});
      };
      let read = ( offset, count ) => {
        let command = new Uint8Array([
	  0x28, // READ(10)
	  0, // LUN
	  ( offset >> 24 ) & 0xFF, // LBA
	  ( offset >> 16 ) & 0xFF,
	  ( offset >> 8 ) & 0xFF,
	  offset & 0xFF,
	  0, // reserved
	  ( count >> 8 ) & 0xFF, // length
	  count & 0xFF,
	  0 // reserved
	]);
        return cbw( 1, sector_size * count, 1, command ).then( result => {
	  return device.transferIn( 1, sector_size * count )
	}).then( result => {
	  return result.data;
	}).then( data => {
	  return csw().then( stat => {
	    return { 'status': stat, 'data': data }
	  });
	});
      };
      let parse_fat32datetime = ( dt, msec ) => {
        // 00000000 00000000 00000000 11111110
        let year = ( dt[ 3 ] >> 1 ) + 1980;
        // 00000000 00000000 11100000 00000001
        let month = ( ( dt[ 3 ] & 0x1 ) << 3 ) | ( dt[ 2 ] >> 5 );
        // 00000000 00000000 00011111 00000000
	let day = dt[ 2 ] & 0x1F;
        // 00000000 11111000 00000000 00000000
	let hour = dt[ 1 ] >> 3;
        // 11100000 00000111 00000000 00000000
	let min = ( ( dt[ 1 ] & 0x07 ) << 3 ) | ( dt[ 0 ] >> 5 );
        // 00011111 00000000 00000000 00000000
	let sec = ( ( dt[ 1 ] & 0x1F ) << 1 ) + msec / 100;
        return year.toString(10) + '年' + radec1( month ) + '月' + radec1( day ) + '日' + radec1( hour ) + '時' + radec1( min ) + '分' + radec1( sec ) + '秒';
      };
      let sjis_decoder = new TextDecoder( 'shift_jis' );
      let utf16_decoder = new TextDecoder( 'utf-16le' );
      let parse_fat32directory = ( data ) => {
	let files = [];
	let lfn = [];
	for( let offset = 0; offset != data.byteLength; offset += 32 ) {
	  let entry = data.subarray( offset, offset + 32 );
	  let attribute = entry[ 11 ];
	  let sfn_head = entry[ 0 ];
	  if( sfn_head == 0x00 ) {
	    break;
	  }
	  else if( sfn_head == 0xE5 ) {
	    continue;
	  }
	  else if( attribute == 0x0F ) {
	    let fragment = new Uint8Array( 26 );
	    fragment.set( entry.subarray( 1, 11 ), 0 );
	    fragment.set( entry.subarray( 14, 26 ), 10 );
	    fragment.set( entry.subarray( 28, 32 ), 22 );
	    lfn.push( fragment );
	  }
	  else if( attribute & 0x8 ) {
	    if( sfn_head == 0x05 ) {
	      sfn_head = 0xE5;
	    }

	    let volume_name = new Uint8Array( 8 + 3 );
	    volume_name[ 0 ] = sfn_head;
	    volume_name.set( entry.subarray( 1, 11 ), 1 );
	    console.log( "VolumeID: " +  sjis_decoder.decode( volume_name ) );
	  }
	  else {
	    if( sfn_head == 0x05 ) {
	      sfn_head = 0xE5;
	    }
	    let sfn = new Uint8Array( 8 );
	    sfn[ 0 ] = sfn_head;
	    sfn.set( entry.subarray( 1, 8 ), 1 );
	    let ext = entry.subarray( 8, 11 );
	    let filename = '';
	    if( lfn.length != 0 ) {
	      let len = lfn.map( x => { return x.byteLength; } ).reduce( ( x, y, i, a ) => { return x + y; } );
	      let cat = new Uint8Array( len );
	      let offset = 0;
	      for( let index = 0; index != lfn.length; index++ ) {
	        let rindex = lfn.length - index - 1;
	        cat.set( lfn[ rindex ], offset );
	        offset += lfn[ rindex ].byteLength;
	      }
	      filename = utf16_decoder.decode( cat );
	      let filename_end = filename.indexOf( '\0' );
	      if( filename_end != -1 ) {
	        filename = filename.substr( 0, filename_end );
	      }
	    }
	    else {
	      filename = sjis_decoder.decode( sfn );
	      let filename_end = filename.indexOf( ' ' );
	      if( filename_end != -1 ) {
	        filename = filename.substr( 0, filename_end );
	      }
	      let fileext = sjis_decoder.decode( ext );
	      let fileext_end = fileext.indexOf( ' ' );
	      if( fileext_end != -1 ) {
	        fileext = fileext.substr( 0, fileext_end );
	      }
	      if( fileext.length != 0 ) {
	        filename = filename + '.' + fileext;
	      }
	    }
	    let read_only = ( attribute & 0x01 ) != 0;
	    let system = ( attribute & 0x02 ) != 0;
	    let hidden = ( attribute & 0x04 ) != 0;
	    let is_dir = ( attribute & 0x10 ) != 0;
	    let create_time = parse_fat32datetime( entry.subarray( 14, 18 ), entry[ 13 ] );
	    let write_time = parse_fat32datetime( entry.subarray( 22, 26 ), 0 );
	    let cluster = entry[ 26 ] | ( entry[ 27 ] << 8 ) | ( entry[ 20 ] << 16 ) | ( entry[ 21 ] );
	    let size = entry[ 28 ] | ( entry[ 29 ] << 8 ) | ( entry[ 30 ] << 16 ) | ( entry[ 31 ] );
	    files.push({
	      'name': filename,
	      'read_only': read_only,
	      'system': system,
	      'hidden': hidden,
	      'is_dir': is_dir,
	      'created_date': create_time,
	      'write_date': write_time,
	      'head': cluster,
	      'size': size
	    });
	    lfn = [];
	  }
	}
	return files;
      };
      let get_fat32clusters_reversed = ( fsinfo, head ) => {
        let next = fsinfo.fat[ head ] & 0x0FFFFFFF;
	if( next >= 0x00000002 && next <= 0x0ffffff6 ) {
	  let tail = get_fat32clusters_reversed( fsinfo, next );
          tail.push( head );
	  return tail;
	}
	else return [ head ];
      };
      let get_fat32clusters = ( fsinfo, head ) => {
        let clusters = get_fat32clusters_reversed( fsinfo, head );
	clusters.reverse();
	let chunks = [ { 'at': clusters[ 0 ], 'length': 1 } ];
	for( let i = 1; i != clusters.length; i++ ) {
	  if( clusters[ i - 1 ] + 1 == clusters[ i ] ) {
	    chunks[ chunks.length - 1 ].length++;
	  }
	  else {
	    chunks.push( { 'at': clusters[ i ], 'length': 1 } );
	  }
	}
	return chunks;
      }
      let load_fat32cluster = ( fsinfo, chunks, index, data ) => {
	let lba = fsinfo.clusters_lba + ( chunks[ index ].at - 2 ) * fsinfo.cluster_size;
	return read( lba, chunks[ index ].length * fsinfo.cluster_size ).then( result => {
	  data.push( result.data );
	  if( index + 1 < chunks.length ) {
	    return load_fat32cluster( fsinfo, chunks, index + 1, data );
	  }
	  else return data;
	} );
      }
      let load_fat32file = ( fsinfo, head, size ) => {
        let clusters = get_fat32clusters( fsinfo, head );
        return load_fat32cluster( fsinfo, clusters, 0, [] ).then( data => {
          let len = data.map( x => { return x.byteLength; } ).reduce( ( x, y, i, a ) => { return x + y; } );
          let cat = new Uint8Array( len );
          let offset = 0;
          for( let index = 0; index != data.length; index++ ) {
	    for( let b = 0; b != data[ index ].byteLength; b++ ) {
	      cat[ offset + b ] = data[ index ].getUint8( b );
	    }
            offset += data[ index ].byteLength;
          }
          if( size != 0 && size < cat.length ) {
	    return cat.subarray( 0, size );
	  }
	  else {
	    return cat;
	  }
	});
      };
      let dump_directory = ( dir ) => {
        let serialized = '';
	for( let i = 0; i != dir.length; i++ ) {
	  let attr = '';
	  if( dir[ i ].is_dir ) {
	    attr += 'd';
	  }
	  else {
	    attr += '-';
	  }
	  if( dir[ i ].read_only ) {
	    attr += 'r';
	  }
	  else {
	    attr += '-';
	  }
	  if( dir[ i ].hidden ) {
	    attr += 'h';
	  }
	  else {
	    attr += '-';
	  }
	  if( dir[ i ].system ) {
	    attr += 's';
	  }
	  else {
	    attr += '-';
	  }
	  serialized += 'ファイル名:\t' + dir[ i ].name + '\r\n';
	  serialized += '  属性:\t\t' + attr + '\r\n';
	  serialized += '  作成時刻:\t' + dir[ i ].created_date + '\r\n';
	  serialized += '  最終更新時刻:\t' + dir[ i ].write_date + '\r\n';
	  serialized += '  先頭クラスタ:\t' + dir[ i ].head + '\r\n';
	  serialized += '  サイズ:\t' + dir[ i ].size + '\r\n';
	}
	return serialized;
      }
      let find_fat32file_entry = ( dir, name ) => {
        return dir.find( ( x, i, a ) => { return x.name == name; } );
      }
      let find_fat32file_internal = ( fat32, dir, path ) => {
	if( path.length == 0 ) {
	  return undefined;
	}
	let entry = find_fat32file_entry( dir, path[ 0 ] );
	if( entry === undefined ) {
	  return undefined;
	}
	if( path.length == 1 ) {
	  return load_fat32file( fat32, entry.head, entry.size );
	}
	else {
	  return load_fat32file( fat32, entry.head, entry.size ).then( raw => {
	    let next_dir = parse_fat32directory( raw );
	    path.shift();
	    return find_fat32file_internal( fat32, next_dir, path );
	  });
	}
      };
      let find_fat32file = ( fat32, path ) => {
        let splitted = path.split( '/' );
	return find_fat32file_internal( fat32, fat32.rootdir, splitted );
      }
      let load_fat32 = partition => {
        return read( partition.at, 1 ).then( result => {
	  let cluster_size = result.data.getUint8( 13 );
	  let reserved_sector_size = result.data.getUint16( 14, true );
	  let num_fats = result.data.getUint8( 16 );
	  let rde_size = result.data.getUint16( 17, true );
	  let fat_size = result.data.getUint32( 36, true );
	  let rde = result.data.getUint32( 44, true );
	  let fat_lba = partition.at + reserved_sector_size;
	  return read( fat_lba, fat_size ).then( result => {
	    let len = result.data.byteLength / 4;
	    let fat = new Uint32Array( len );
	    for( let i = 0; i != len; i++ ) {
	      fat[ i ] = result.data.getUint32( i * 4, true );
	    }
	    let clusters_lba = fat_lba + num_fats * fat_size;
	    let fsinfo = {
	      'cluster_size': cluster_size,
	      'fat': fat,
              'clusters_lba': clusters_lba,
	      'rootdir_entry': rde
	    };
	    return load_fat32file( fsinfo, fsinfo.rootdir_entry, 0 ).then( raw_root_dir => {
	      let root_dir = parse_fat32directory( raw_root_dir );
	      fsinfo[ 'rootdir' ] = root_dir;
              return fsinfo;
	    });
	  });
	});
      };
      return device.open().then(() => {
        if(device.configuration === null) {
          return device.selectConfiguration(1);
        }
      }).then(() => {
        return device.claimInterface(0);
      }).then(() => {
        return device.controlTransferIn({
          'requestType': 'class',
          'recipient': 'interface',
          'request': 0xfe,
          'value': 0x00,
          'index': 0x00
        }, 1);
      }).then(() => {
        console.log('接続中');
        connectButton.textContent = '切断';
	connectButton.disabled = false;
        inquiry().then( result => {
	  return test_unit_ready();
	}).then( () => {
	  return read_capacity();
	}).then( result => {
	  return read( 0, 1 );
	}).then( result => {
	  let signature = result.data.getUint16( 510 );
	  if( signature != 0x55aa ) {
	    throw new Error( 'デバイスはフォーマットされていない\n' );
	  }
	  let partition_table = parse_partition_table( result.data );
	  if( partition_table[ 0 ].type != 0x0b ) {
	    throw new Error( 'FAT32以外のファイルシステムでフォーマットされている\n' );
	  }
	  return load_fat32( partition_table[ 0 ] );
	}).then( fat32 => {
	  let serialized = dump_directory( fat32.rootdir );
	  t.write( serialized );
	  return fat32;
	}).then( fat32 => {
	  let filename = document.getElementById( 'file' ).value;
	  let file = find_fat32file( fat32, filename );
	  if( file !== undefined ) {
	    return file.then( raw_file => {
	      if( raw_file === undefined ) {
	        t.write( filename + 'は見つからなかった\r\n' );
	        return;
	      }
	      let ext_ = filename.split( '.' );
	      let ext = ext_.pop();
	      let url_creator = window.URL || window.webkitURL;
	      if( ext == 'png' ) {
                let blob = new Blob([raw_file.buffer],{type:"image/png"});
	        let image_url = url_creator.createObjectURL( blob );
                let img = document.getElementById( "image" );
	        img.src = image_url;
	      }
	      else if( ext == 'jpg' || ext == 'jpeg' ) {
                let blob = new Blob([raw_file.buffer],{type:"image/jpeg"});
	        let image_url = url_creator.createObjectURL( blob );
                let img = document.getElementById( "image" );
	        img.src = image_url;
	      }
	    });
	  }
	});
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
