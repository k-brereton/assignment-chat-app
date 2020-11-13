import React, {ChangeEvent, SyntheticEvent, useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import './App.css';
import {io, Socket} from 'socket.io-client';
import {Button, Container, Form, FormControl, InputGroup, Modal, Spinner, Table} from "react-bootstrap";

interface User{
    id:number;
    username:string;
    color:string;
    number_of_connections:number;
}
interface Message {
    time_stamp:string
    from:number;
    content:string;
}
interface ChatState{
    users:User[];
    messages:Message[];
}

function sendIoMessage(connection:Socket|null,endpoint:string,message:string,onError:(error_message: string)=>void){
    if(connection===null){
        onError("error, no connection to server");
    }
    else{
        connection.emit(endpoint,message);
    }
}
function useChatApp(onError:(error_message: string)=>void){
    const [chatState,setChatState]=useState<ChatState>({users:[],messages:[]})
    const connectionRef=useRef<Socket|null>(null);
    const [id,setUserId]=useState<number|null>(null);

    useEffect(()=>{
        const getId=async ()=>{
            try{
                const response= await fetch("/userId");
                if(response.ok){
                    const responseId=parseInt(await response.text())
                    setUserId(responseId);
                    const connection=io().connect();
                    connection.on("chat_state",(msg:string)=>setChatState(JSON.parse(msg)));
                    connection.on("input_error",(error:string)=>{onError(error);})
                    connectionRef.current=connection;
                }
                else{
                    onError( await response.text());
                }
            }catch (e){
                onError(e.message);
            }
        }
        getId()
    },[onError]);

    const sendMessage= useCallback((message:string)=>sendIoMessage(connectionRef.current,"chat message",message,onError),[connectionRef,onError]);
    const updateName=useCallback((new_name:string)=>sendIoMessage(connectionRef.current,"rename",new_name,onError),[connectionRef,onError]);
    const updateColor=useCallback((new_color:string)=>sendIoMessage(connectionRef.current,"recolor","#"+new_color,onError),[connectionRef,onError]);
    return {...chatState,id,sendMessage,updateName,updateColor};
}

function replaceEmojisInput(trimmed: string) {
    return trimmed.replace(/[:][)]/,"😁").replace(/[:][(]/,"🙁").replace(/[:][o]/,"😲");
}

function getNameUpdateFromInput(trimmed: string) {
    const nameMatch=trimmed.match(/^[/]name ([A-Za-z0-9]+)$/)
    if (nameMatch===null){
        throw new Error("invalid rename, please only use letters or numbers for name");
    }
    else{
        return nameMatch[1]
    }
}

function getColorUpdateFromInput(trimmed: string) {
    const nameMatch=trimmed.match(/^[/]color ([a-fA-F0-9]{6})$/)
    if (nameMatch===null){
        throw new Error("invalid color, please only use format '/color RRGGBB'");
    }
    else{
        return nameMatch[1].toUpperCase()
    }
}
function MessagesList({messages,id,users}:{messages:Message[],id:number,users:User[]}){

    const lastTableElementRef=useRef<any>(null)
    const previousMessagesRef=useRef<Message[]|null>(null)


    messages.sort((a,b)=>Date.parse(a.time_stamp) - Date.parse(b.time_stamp));


    const usersById=Object.fromEntries(users.map(user=>[user.id.toString(),user]))
    const lastMessageIndex=messages.length-1
    const messagesList=messages.map((message,index)=> {
        const userFrom=usersById[message.from.toString()]
        let style={};
        if(userFrom.id === id){
            style={fontWeight:"bold"};
        }
        const time=new Date(message.time_stamp);
        const content=<>
            <td style={{width:"15%"}}>{time.toLocaleTimeString([],{ hour: '2-digit', minute: '2-digit',hour12: false})}</td>
            <td style={{color:userFrom.color,width:"15%"}}>{userFrom.username}</td>
            <td style={{width:"70%"}}>{message.content}</td>
        </>
        if(index === lastMessageIndex){
            return <tr ref={lastTableElementRef} key={"messagesUl" + index} style={style}>
                {content}
            </tr>
        }
        else{
            return <tr key={"messagesUl" + index} style={style}>
                {content}
            </tr>

        }
    })
    useLayoutEffect(()=>{
        if(lastTableElementRef.current!==null&&JSON.stringify(messages)!==JSON.stringify(previousMessagesRef.current)){
            lastTableElementRef.current.scrollIntoView();
        }
        previousMessagesRef.current=messages;
    },[messages])
    return <div className={"table-bottom-div"}>
        <Table responsive striped bordered hover>
        <tbody>
            {messagesList}
        </tbody>
    </Table>
    </div>
}

function UserList({users,id}:{id:number,users:User[]}){
    const theUser=users.find(user=>user.id === id);
    const otherUsers=users.filter(user=>user.number_of_connections!==0&&user.id!==id);
    otherUsers.sort();
    if(typeof theUser=== "undefined"){
        return <div>error, could not find user</div>
    }
    const otherUserRows=otherUsers.map(user=><tr key={user.username+" user name row"}><td style={{color:user.color}}>{user.username}</td></tr>)
    return <Table responsive striped bordered hover>
        <thead>
            <tr>
                <th>Users</th>
            </tr>
        </thead>
        <tbody>
            <tr><td style={{color:theUser.color}}>{theUser.username + " (you)"}</td></tr>
            {otherUserRows}
        </tbody>
    </Table>
}


function App() {
    const [error,onError]=useState<string|null>(null)
    const {users,messages,id,sendMessage,updateName,updateColor}=useChatApp(onError);
    const [input,setInput]=useState("");
    const onButtonClick=(evt: SyntheticEvent)=>{
        evt.preventDefault();
        const trimmed=input.trim();
        try{
            if(trimmed.startsWith("/name")){
                updateName(getNameUpdateFromInput(trimmed))
                setInput("");
            }
            else if (trimmed.startsWith("/color")){
                updateColor(getColorUpdateFromInput(trimmed))
                setInput("");
            }
            else if (trimmed.startsWith("/")){
                onError(`error, illegal command '${trimmed}'. /name and /color are the only available commands. lowercase is needed.`)
            }
            else if(trimmed!==""){
                const emojiedInput=replaceEmojisInput(trimmed)
                sendMessage(emojiedInput);
                setInput("");
            }
        }catch (e){
            onError(e.message)
        }
    }
    const handleChange=(event:ChangeEvent<HTMLInputElement>)=>{
        setInput(event.target.value);
    }

    if(id === null||users.length===0){
        return <div className="loading"><Spinner animation="border" /></div>
    }

    else{
        return <div className="App">
            <Modal show={error!==null} onHide={()=>onError(null)}>
                <Modal.Header closeButton>
                    <Modal.Title>Error</Modal.Title>
                </Modal.Header>
                <Modal.Body>{error}</Modal.Body>
            </Modal>
            <MessagesList messages={messages} id={id} users={users}/>
            <UserList id={id} users={users}/>
            <div className="centering">
                <Container>
                    <Form onSubmit={onButtonClick}>
                        <InputGroup>
                            <FormControl onChange={handleChange} placeholder="message"
                                         aria-label="message" value={input} onSubmit={onButtonClick}/>
                            <InputGroup.Append>
                                <Button variant="outline-secondary" type="submit">Send</Button>
                            </InputGroup.Append>
                        </InputGroup>
                    </Form>
                </Container>
            </div>
        </div>
    }
}

export default App;
