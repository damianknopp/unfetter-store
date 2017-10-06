const SwaggerExpress = require('swagger-express-mw');
const path = require('path');
const bodyParser = require('body-parser');
const app = require('express')();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.STIX_API_PROTOCOL = process.env.STIX_API_PROTOCOL || 'https';
process.env.STIX_API_HOST = process.env.STIX_API_HOST || 'localhost';
process.env.STIX_API_PORT = process.env.STIX_API_PORT || '443';
process.env.STIX_API_PATH = process.env.STIX_API_PATH || 'cti-stix-store-api';

process.env.ENV = process.env.ENV || 'dev';

if (process.env.ENV === 'dev') {
  // in dev mode, ignore self-signed cert errors
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({
  extended: true,
  limit: '5mb'
}));

app.use(passport.initialize());
app.use(passport.session());

require('./api/config/passport-config')['setStrategy'](passport);

app.use('/auth', require('./api/express-controllers/auth'));
// app.use('*', passport.authenticate('jwt', { session: false }), (req, res, next) => {
//   next();
// });
const config = {
  appRoot: __dirname,
  swaggerFile: path.join(__dirname, '/api/swagger/swagger.yaml')
};

SwaggerExpress.create(config, (err, swaggerExpress) => {
  if (err) { throw err; }

  // install middleware
  swaggerExpress.register(app);
});

module.exports = app;
