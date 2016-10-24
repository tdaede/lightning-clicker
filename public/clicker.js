var userid = null;

$(function() {
  if(localStorage.getItem('userid')) {
    login();
  } else {
    $.get('/new_user',function(data) {
      console.log('Created user',data.id);
      localStorage.setItem('userid',data.id);
      login();
    });
  }
});

function login() {
  userid = localStorage.getItem('userid');
  $('#userid').html(userid);
  setInterval(update_stats,1000);
}

var current_invoice_label = null;

function create_invoice(product) {
  $.get('/create_invoice',{userid:userid,product:product},function(data) {
    current_invoice_label = data.label;
    $('#amount').html(data.amount);
    $('.invoice_amount').html(data.amount);
    $('.invoice_product').html(product);
    $('#rhash').html(data.rhash);
    $('#paybox').slideDown();
    $('#paidbox').slideUp();
  });
}

function update_invoice() {
  if (current_invoice_label) {
    $.get('/get_invoice',{label: current_invoice_label},function(data) {
      if (data.complete) {
        $('#invoice_status').html('complete');
        $('#paybox').slideUp();
        $('#paidbox').slideDown();
      }
      else {
        $('#invoice_status').html('waiting');
      }
    });
  }
}

function update_stats() {
  update_invoice();
  $.get('/user',{userid:userid},function(data) {
    for (const product in data.products) {
      const row = $('#'+product);
      row.children('.count').html(parseInt(data.products[product]));
    }
  });
}
