const express = require('express');
const cookieParser = require('cookie-parser');
const cookie= require("cookie")

const app = express();
app.use(cookieParser())

app.use(express.static('public'))

const http = require('http').createServer(app);
const io = require('socket.io')(http);

let users=[];
let messages=[];

function sendServerState(){
    io.emit('chat_state', JSON.stringify({users,messages}));
}
function sendInputError(socket,errorMessage){
    socket.emit('input_error', errorMessage);
}

function isInvalidUserName(id,name){
    return users.some(user=>user.username === name&&user.id!==id);
}

function isInvalidColor(color){
    return !(/^#([a-fA-F0-9]{6})$/.test(color))
}

function addUserWithId(id){
    let generated_name=null;
    while(generated_name===null){
        generated_name=Math.random().toString(36).substring(2);
        if(isInvalidUserName(null,generated_name)){
            generated_name=null;
        }
    }
    const newUser={color:"#EEEEEE",id,username:generated_name,number_of_connections:0}
    users.push(newUser);
    sendServerState();
    return newUser;
}

function addUser(){
    const id=users.reduce((previousMax,user)=>user.id > previousMax ? user.id:previousMax, 0) + 1;
    return addUserWithId(id);
}

function modifyUser(id,username,color,number_of_connections,socket){

    const color_uppercase=color.toUpperCase();
    const found_user_index=users.findIndex(user=>user.id===id);
    if(found_user_index===-1){
        sendInputError(socket,"user id not found");
    }
    else if (isInvalidUserName(id,username)){
        sendInputError(socket,"user name taken");
    }
    else if(isInvalidColor(color_uppercase)){
        sendInputError(socket,"please input a valid color in #RRGGBB format");
    }
    else{
        users[found_user_index]={id, username, color, number_of_connections };
        sendServerState();
    }
}

function addMessage(from,content){
    const time_stamp=new Date().toUTCString();
    const newMessages=messages.length >= 200? messages.slice(1,200):[...messages];
    newMessages.push({time_stamp,from,content})
    newMessages.sort((a,b)=>Date.parse(a.time_stamp) - Date.parse(b.time_stamp));
    messages=newMessages
    sendServerState()
}

app.get("/userId",(req, res) => {
    let userId;
    if(typeof req.cookies.kevin_brereton_ass3_chat_id_513 === "undefined"){
        const newUser=addUser();
        res.cookie("kevin_brereton_ass3_chat_id_513",newUser.id);
        userId=newUser.id
    }
    else{
        userId=parseInt(req.cookies.kevin_brereton_ass3_chat_id_513);
        if(users.findIndex(user=>user.id===userId)===-1){
            addUserWithId(userId);
        }
    }
    res.send(userId.toString());
})

io.on('connection', socket => {
    const userId=parseInt(cookie.parse(socket.request.headers.cookie).kevin_brereton_ass3_chat_id_513);
    const connection_user=users.find(single_user=>single_user.id === userId);
    if(typeof connection_user === "undefined"){
        socket.close()
    }
    modifyUser(userId,connection_user.username,connection_user.color,connection_user.number_of_connections+1,socket)

    socket.on('disconnect', () => {
        const user=users.find(single_user=>single_user.id === userId);
        modifyUser(userId,user.username,user.color,user.number_of_connections-1,socket)
    });
    socket.on('chat message', msg => {
        addMessage(userId,msg);
    });
    socket.on('rename', msg => {
        const user=users.find(single_user=>single_user.id === userId);
        modifyUser(userId,msg,user.color,user.number_of_connections,socket);
    });
    socket.on('recolor', msg => {
        const user=users.find(single_user=>single_user.id === userId);
        modifyUser(userId,user.username,msg,user.number_of_connections,socket);
    });
});

http.listen(45176, () => {
    console.log('listening on *:45176');
});