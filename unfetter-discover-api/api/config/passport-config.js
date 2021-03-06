const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

const userModel = require('../models/user');
const config = require('./config');

const passportConfig = {};

passportConfig.setStrategy = passport => {
    const opts = {};
    opts.jwtFromRequest = req => {
        let token = null;
        if (req.headers.authorization) {
            token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        } else {
            token = ExtractJwt.fromUrlQueryParameter('authorization')(req);
            if (token && token.match(/^Bearer /) !== null) {
                token = token.split('Bearer ')[1].trim();
            }
        }
        return token;
    };
    opts.secretOrKey = config.jwtSecret;
    passport.use(new JwtStrategy(opts, (jwtPayload, done) => {
        userModel.findById(jwtPayload._id, (err, user) => {
            if (err) {
                return done(err, false);
            }

            if (user) {
                return done(null, user);
            }
            return done(null, false);
        });
    }));
};

passportConfig.jwtStandard = (req, res, next) => {
    const user = req.user;
    if (!user || !user.approved || user.locked) {
        return res.status(403).json({
            errors: [{
                status: 403,
                source: '',
                title: 'Error',
                code: '',
                detail: 'Unauthorized.  You are not approved to use unfetter'
            }]
        });
    }
    next();
};

passportConfig.jwtAdmin = (req, res, next) => {
    const user = req.user;
    // Verify they have admin role
    if (!user || !user.approved || user.locked || user.role !== 'ADMIN') {
        return res.status(403).json({
            errors: [{
                status: 403,
                source: '',
                title: 'Error',
                code: '',
                detail: 'Unauthorized.  Only admins may access the admin route'
            }]
        });
    }
    next();
};

passportConfig.jwtOrganizations = (req, res, next) => {
    const user = req.user;
    // Verify they have admin or org leader role
    if (!user || !user.approved || user.locked || (user.role !== 'ADMIN' && user.role !== 'ORG_LEADER')) {
        return res.status(403).json({
            errors: [{
                status: 403,
                source: '',
                title: 'Error',
                code: '',
                detail: 'Unauthorized.  Only admins and organization leaders may access the organizations route'
            }]
        });
    }
    next();
};

module.exports = passportConfig;
