bootstrap_alert = function() {}
bootstrap_alert.warning = function(message) {
  $('#alert_placeholder').html('<div class="alert alert-warning alert-dismissible" role="alert"><button type="button" class="close" data-dismiss="alert" aria-label="Close">&times;</span></button>'+message+'</div>')
}
bootstrap_alert.success = function(message) {
  $('#alert_placeholder').html('<div class="alert alert-success alert-dismissible" role="alert"><button type="button" class="close" data-dismiss="alert" aria-label="Close">&times;</span></button>'+message+'</div>')
}

