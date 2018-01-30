import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as socketIo from 'socket.io';

import app from './app';
import { mongoInit } from './mongoInit';
import { jwtVerify } from '../middleware/jwtVerify';
import userModel from '../models/mongoose/user';
import { connections } from '../models/connections';
import { WSMessageTypes } from '../models/messages';
import notificationStoreModel from '../models/mongoose/notification-store'
import { NotificationRecieveTypes } from '../models/notifiction-recieve-types.enum';

mongoInit();

const UNFETTER_OPEN_ID: string = 'identity--e240b257-5c42-402e-a0e8-7b81ecc1c09a';

const server: any = https.createServer({
    key: fs.readFileSync('/etc/pki/tls/certs/server.key'),
    cert: fs.readFileSync('/etc/pki/tls/certs/server.crt')
}, app);

const io = socketIo(server, {
    path: '/socket'
});

io.use((client: any, next: any) => {
    let errorMsg = '';

    if (client.handshake.query && client.handshake.query.token) {

        const token = client.handshake.query.token;
        jwtVerify(token)
            .then((user) => {
                userModel.findById(user._id, (err, mongoUser: any) => {
                    if (err) {
                        errorMsg = 'Unable to retrieve user';
                        console.log(errorMsg);
                        next(new Error(errorMsg));
                        client.disconnect();
                    } else {
                        const userObj = mongoUser.toObject()
                        connections.push({
                            user: userObj,
                            token,
                            client,
                            connected: false
                        });
                        console.log(userObj.userName, 'successfully attempted websocket connection');
                        next();
                    }
                });
            })
            .catch((err) => {
                errorMsg = 'Malformed or invalid token sent';
                console.log(errorMsg);
                next(errorMsg);
                client.disconnect();
            });

    } else {
        errorMsg = 'Token not included in request';
        console.log(errorMsg);
        next(new Error(errorMsg));
        client.disconnect();
    }
});

io.on('connection', (client: any) => {
    console.log('Number of connections on connect: ', connections.length);
    const clientConnection = connections.find((conn) => conn.client === client);

    if (clientConnection) {

        console.log('Client successfully connected');
        clientConnection.connected = true;
        clientConnection.client.send({
            messageType: WSMessageTypes.SYSTEM,
            messageContent: 'Web socket connection successful'
        });

        // Join organization rooms
        // clientConnection.user.organizations
        //     .filter((org: { id: string }) => org.id !== UNFETTER_OPEN_ID)
        //     .filter((org: { approved: boolean }) => !!org.approved)
        //     .forEach((org: { id: string }) => {
        //         console.log(clientConnection.user._id, 'joined', org.id);
        //         clientConnection.client.join(org.id);
        //     });

        clientConnection.client.on('disconnect', () => {
            connections.splice(connections.indexOf(clientConnection), 1);
            console.log('Client disconnected');
            console.log('Number of connections on disconnect: ', connections.length);
        });

        clientConnection.client.on('message', (data: any) => {
            const userId = clientConnection.user._id;
            console.log(data);
            switch (data.messageType) {
                case NotificationRecieveTypes.READ_NOTIFICATION:
                    console.log('Reading notification');
                    notificationStoreModel.findByIdAndUpdate(data.messageContent, { $set: { read: true } }, (err, result) => {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log('Notification read');
                        }
                    });
                    break;
                case NotificationRecieveTypes.DELETE_NOTIFICATION:
                    console.log('Deleting notification');
                    notificationStoreModel.findByIdAndRemove(data.messageContent, (err, result) => {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log('Notification deleted');
                        }
                    });
                    break;
                case NotificationRecieveTypes.READ_ALL_NOTIFICATIONS:
                    console.log('Reading all notification');
                    notificationStoreModel.update({ userId }, { $set: { read: true } }, { multi: true }, (err, result) => {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log(result);
                            console.log('All notifications read');
                        }
                    });
                    break;
                case NotificationRecieveTypes.DELETE_ALL_NOTIFICATIONS:
                    console.log('Deleting all notification');
                    notificationStoreModel.remove({ userId }, (err) => {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log('All notifications deleted');
                        }
                    });
                    break;                    
                default:
                    console.log('No action for message:\n', data);
            }
        });

    } else {
        console.log('User not found in connections array');
    }    
});

server.listen(3333, () => {
    console.log('Server is listening');
});

export default io;