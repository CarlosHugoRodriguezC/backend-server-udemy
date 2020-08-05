var express = require('express');
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');

var SEED = require('../config/config').SEED;


var app = express();
var Usuario = require('../models/usuario');

//google

var CLIENT_ID = require('../config/config').CLIENT_ID;
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(CLIENT_ID);

/**
 * autenticacion de google
 */
async function verify(token) {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: CLIENT_ID, //specify the CLIENT_ID of the app
        // Or, if multiple clients access to backend:
        //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
    });
    const payload = ticket.getPayload();
    const userid = payload('sub');
    // if request specified a G Suite domain:
    // const domain = payload['hd'];
    return {
        nombre: payload.name,
        email: payload.email,
        img: payload.picture,
        google: true
    }
}

app.post('/google', async(req, res) => {

    var token = req.body.token;
    var googleUser = await verify(token).catch(e => {
        res.status(403).json({
            ok: false,
            mensaje: 'token no valido ' + e
        })
    });

    Usuario.findOne({ email: googleUser.email }, (err, usuarioDB) => {

        if (err) {
            return res.status(500).json({
                ok: false,
                mensaje: 'Error al buscar usuario',
                errors: err
            });
        }
        if (usuarioDB) {

            if (usuarioDB.google === false) {
                return res.status(400).json({
                    ok: false,
                    mensaje: 'Debe de usar su autenticacion normal',
                    errors: { message: 'requiere uso de autenticacion normal' }
                });
            } else {
                usuarioDB.password = ':v';
                var token = jwt.sign({ usuario: usuarioDB }, SEED, { expiresIn: 14400 }); // 4 horas

                res.status(200).json({
                    ok: true,
                    mensaje: 'Login ok',
                    usuario: usuarioDB,
                    id: usuarioDB._id,
                    token: token
                });
            }

        } else {
            //el usuario no existe
            var usuario = new Usuario();

            usuario.nombre = googleUser.nombre,
                usuario.email = googleUser.email,
                usuario.img = googleUser.img,
                usuario.google = true,
                usuario.password = ':v';

            usuario.save((err, usuarioDB) => {
                var token = jwt.sign({ usuario: usuarioDB }, SEED, { expiresIn: 14400 }); // 4 horas

                res.status(200).json({
                    ok: true,
                    mensaje: 'Login ok',
                    usuario: usuarioDB,
                    id: usuarioDB._id,
                    token: token
                });
            })
        }


    });

    // res.status(200).json({
    //     ok: true,
    //     mensaje: 'Login ok',
    //     googleUser: googleUser
    // });
});

/**
 * atenticacion normal
 */
app.post('/', (req, res) => {


    var body = req.body;

    Usuario.findOne({ email: body.email }, (err, usuarioDB) => {

        if (err) {
            return res.status(500).json({
                ok: false,
                mensaje: 'Error al buscar usuario',
                errors: err
            });
        }

        if (!usuarioDB) {
            return res.status(400).json({
                ok: false,
                mensaje: 'Credenciales incorrectas - email',
                errors: err
            });
        }


        if (!bcrypt.compareSync(body.password, usuarioDB.password)) {
            return res.status(400).json({
                ok: false,
                mensaje: 'Credenciales incorrectas - password',
                errors: err
            });
        }

        // crear un token!!!
        usuarioDB.password = ':v';
        var token = jwt.sign({ usuario: usuarioDB }, SEED, { expiresIn: 14400 }); // 4 horas

        res.status(200).json({
            ok: true,
            mensaje: 'Login ok',
            usuario: usuarioDB,
            id: usuarioDB._id,
            token: token
        });
    });



});



module.exports = app;