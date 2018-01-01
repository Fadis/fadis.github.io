bootstrap_alert = function() {}
bootstrap_alert.warning = function(message) {
  $('#alert_placeholder').html('<div class="alert alart-warning alert-dismissable"><a class="close" data-dismiss="alert">×</a><span>'+message+'</span></div>')
}
bootstrap_alert.success = function(message) {
  $('#alert_placeholder').html('<div class="alert alart-success alert-dismissable"><a class="close" data-dismiss="alert">×</a><span>'+message+'</span></div>')
}

