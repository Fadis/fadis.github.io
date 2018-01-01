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
    bootstrap_alert.warning('このWebページを正しく動作させるにはWebGLに対応したブラウザが必要です');
    let first_time = true
    addEventListener('devicemotion', function( e ) {
      if( e.accelerationIncludingGravity.x !== null ) {
        if( first_time ) {
          first_time = false;
          bootstrap_alert.success('加速度センサーを検出しました。端末を傾けてみましょう。');
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
          bootstrap_alert.success('ウィンドウを動かしてみましょう。');
        }
      }
    } );
  }
  else {
    first_time = false;
    bootstrap_alert.success('ウィンドウを動かしてみましょう。');
  }
  $(window).on('resize', function(){
    var canvas = $("#keys").get( 0 );
    video_process.resize();
    video_process.render();
  });
});

