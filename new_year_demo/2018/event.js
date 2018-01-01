$(document).ready(function() {
  try {
    video_process = new Renderer( "#keys" );
    video_process.render();
  }
  catch(e) {
    console.log(e.message);
    throw e;
    return;
  }
  setInterval( function(){
    video_process.render();
  }, 50 );
  if( window.DeviceMotionEvent !== undefined ) {
    bootstrap_alert.warning('����Web�ڡ�����������ư�����ˤ�WebGL���б������֥饦����ɬ�פǤ�');
    let first_time = true
    addEventListener('devicemotion', function( e ) {
      if( e.accelerationIncludingGravity.x !== null ) {
        if( first_time ) {
          first_time = false;
          bootstrap_alert.success('��®�٥��󥵡��򸡽Ф��ޤ�����ü���򷹤��Ƥߤޤ��礦��');
        }
        video_process.set_gravity( [
          e.accelerationIncludingGravity.x,
          e.accelerationIncludingGravity.y,
          e.accelerationIncludingGravity.z
        ] );
      }
      else {
        if( first_time ) {
          first_time = false;
          bootstrap_alert.success('������ɥ���ư�����Ƥߤޤ��礦��');
        }
      }
    } );
  }
  else {
    first_time = false;
    bootstrap_alert.success('������ɥ���ư�����Ƥߤޤ��礦��');
  }
  $(window).on('resize', function(){
    var canvas = $("#keys").get( 0 );
    video_process.resize();
    video_process.render();
  });
});

