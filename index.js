const config = require('./config.json');
const express = require('express');
const app = express();
app.use(express.static('public'));
const jayson = require('jayson');
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('clickers.sqlite3',function(){
  db.run('CREATE TABLE IF NOT EXISTS `users` ( `id` INTEGER, `creation` INTEGER, `json` BLOB, PRIMARY KEY(`id`) )');
  db.run('CREATE TABLE IF NOT EXISTS "invoices" ( `label` INTEGER PRIMARY KEY AUTOINCREMENT, `user` INTEGER, `product` TEXT, `created` INTEGER )');
});
const l = jayson.client.tcp({path: config.rpc});

const products = {
  'click': {
    cost: 1,
    speed: 0
  },
  'clicker': {
    cost: 100,
    speed: 1
  },
  'strong': {
    cost: 10000,
    speed: 10
  },
  'clicker100': {
    cost: 1000000,
    speed: 100
  },
  'meme': {
    cost: 100000000,
    speed: 1000
  },
  'taco': {
    cost: 17011701,
    speed: 420420
  },
  'postoffice': {
    cost: 99,
    speed: -1
  },
  'sushi': {
    cost: 4294967295,
    speed: 0
  }
};

function get_user(id,callback) {
    db.get('SELECT * FROM users WHERE id = ?',id,function(err,row) {
        callback(JSON.parse(row.json));
    });;
}

function update_user(id, data) {
  db.run('UPDATE users SET json = ? WHERE id = ?',JSON.stringify(data),id,function() {
    // ehh
  });
}

function purchase_product(id, product) {
  /* this is massively racy */
  get_user(id,function(user) {
    if (!('products' in user)) {
      user['products'] = {};
    }
    if (!(product in user.products)) {
      user.products[product] = 0;
    }
    user.products[product] += 1;
    console.log('purchase',id,user);
    update_user(id,user);
  });
}

function tick_user(user) {
  const delta = Date.now()/1000 - user.last;
  user.last = Date.now()/1000;;
  if (!user.products) {
    user.products = {};
  }
  if (!user.products.click) {
    user.products.click = 0;
  }
  for (product in user.products) {
    user.products.click += products[product].speed*delta*user.products[product];
  }
}

app.get('/new_user', function (req, res) {
  db.run('INSERT INTO users VALUES (null,?,?)',Date.now()/1000,'{}',function() {
    res.send({id: this.lastID});
  });
});

app.get('/user',function(req,res) {
  get_user(req.query.userid,function(user) {
    if (!user.last) {
      user.last = 0;
    }
    if ((Date.now()/1000 - user.last) >= 0.5) {
      tick_user(user);
      update_user(req.query.userid,user);
    }
    res.send(user);
  });
});

app.get('/create_invoice',function(req,res) {
  var user = req.query.userid;
  var product = req.query.product;
  var amount = products[product].cost;
  db.run('INSERT INTO invoices VALUES (null,?,?,?)',user,product,Date.now()/1000,function() {
    const label = this.lastID;
    l.request('invoice',{amount:amount,label:label},function(err, response) {
      console.log(err);
      if (err) {
        res.send(err);
      } else {
        if (response.result) {
          res.send({rhash: response.result.rhash, label:label, amount:amount});
        } else {
          res.send(401);
        }
      }
    });
  });
});

app.get('/get_invoice',function(req,res) {
  // we get multiple responses for some reason here
  var sent = false;
  l.request('listinvoice',{label:String(req.query.label)},function(err, response) {
    if (!err) {
      if (!sent) {
        sent = true;
        res.send(response.result);
      }
    }
  });
});

app.listen(config.port, function () {
  console.log('lightning-clicker listening on port',config.port);
});

setInterval(function() {
  db.all('SELECT * from invoices',function(err,rows) {
    for (dbinvoice of rows) {
      l.request('listinvoice',{label:String(dbinvoice.label)}, function(err, response) {
        if(err) {
          console.log(err);
        } else {
          if (response) {
            if (response.result.complete) {
              console.log('Purchase complete!', dbinvoice);
              db.run('DELETE FROM invoices WHERE label = ?',dbinvoice.label)
              purchase_product(dbinvoice.user,dbinvoice.product);
            }
          }
        }
      });
    }
  });
}, 1000);
