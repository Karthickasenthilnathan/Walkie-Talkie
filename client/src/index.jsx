#!/usr/bin/env node

import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';

import { getToken, startAuthFlow } from './services/auth.js';
import { connectSocket } from './services/socket.js';


const renderMessageContent = (msg) => {
    const isSnippet = msg.type === "code_snippet";

    if (!isSnippet) {
        return <Text>{msg.content}</Text>;
    }

    

    return (
        <Box flexDirection="column" marginTop={0}>
        
            <Text color="yellow" bold>
                [{language}]
            </Text>
            <Box
                borderStyle="round"
                borderColor="yellow"
                paddingX={1}
                paddingY={0}
                flexDirection="column"
            >
                {String(content)
                    .split('\n')
                    .map((line, index) => (
                        <Text key={`${msg.id}-code-${index}`} color="yellow">
                            {line === '' ? ' ' : line}
                        </Text>
                    ))}
            </Box>
        </Box>
    );
};

const App = () => {
    const [token, setToken] = useState(getToken());
    const [socket, setSocket] = useState(null);
    const [messages, setMessages] = useState([]);

    const [input, setInput] = useState('');
    const [currentChannel, setCurrentChannel] = useState(null);
    const [mode, setMode] = useState("text");
    const [language, setLanguage] = useState("javascript");
    const { exit } = useApp();


    

    useEffect(() => {
        if (!token) {
            startAuthFlow().then(setToken);
            return;
        }

        const s = connectSocket(token);

        setSocket(s);

        s.on("connect_error", (err) => {
            process.stderr.write(`Connect error: ${err.message}\n`);
            process.stderr.write(`${JSON.stringify(err)}\n`);
        });

        s.on("connect", () => {
            process.stderr.write("Connected!\n");
            s.emit("channels:list");
        });

        s.on("channels:list", (channels) => {
            process.stderr.write(
                `Channels: ${JSON.stringify(channels)}\n`
            );

            if (channels.length > 0) {
                setCurrentChannel(channels[0]);

                // Join the first available channel so Enter can send immediately.
                s.emit("channel:join", channels[0].id);
            }
        });



        s.on('message:new', (msg) => {
            setMessages((prev) => [...prev.slice(-100), msg]);
        });

        return () => s.disconnect();
    }, [token]);
    

    const sendMessage = (value) => {
        //process.stderr.write("REACHEDDDD\n");
        if (!value.trim()) return;
        if (!socket) {
            process.stderr.write("sendMessage blocked: socket not ready\n");
            return;
        }

        //const snippet = parseSnippet(value);
        //const isCode = Boolean(snippet);
        if (!currentChannel) {
            process.stderr.write("sendMessage blocked: no current channel yet\n");
            return;
        }
       const payload =
    mode === "text"
        ? {
              channelId: currentChannel.id,
              type: "text",
              content: value
          }
        : {
              channelId: currentChannel.id,
              type: "code_snippet",
              language,
              content: value
          };

socket.emit("message:send", payload);
/*

        socket.emit('message:send', {
            channelId: currentChannel.id,
            content: isCode ? snippet.content : value,
            type: isCode ? 'code_snippet' : 'text',
            language: isCode ? snippet.language : null,
        });
        */

        setInput("");
setMode("text");
setLanguage("javascript");
    };

useInput((input, key) => {
    if (key.ctrl && input === "c") {
        exit();
        return;
    }

    if (key.ctrl && input === "g") {
        setMode(prev =>
            prev === "text" ? "code" : "text"
        );
    }
});

    return (
        <Box flexDirection="column" height={process.stdout.rows}>
            {/* Header */}
            <Box borderStyle="single" paddingX={1}>
                <Text bold color="green">
                    ⬡ terminal-chat
                </Text>
               <Text>
    {" "}
    — #{currentChannel?.name ?? "Loading..."}
</Text>
            </Box>
            <Box>
 <Text color={mode === "code" ? "cyan" : "green"}>
    {mode === "code"
        ? `Mode: CODE (${language})`
        : "Mode: TEXT"}
</Text>
</Box>

            {/* Messages */}
            <Box
                flexDirection="column"
                flexGrow={1}
                paddingX={1}
                overflowY="hidden"
            >
                {messages.map((msg) => (
                    <Box key={msg.id}>
                        <Text color="cyan">
                            {msg.username}{' '}
                        </Text>

                        <Text dimColor>
                            {new Date(
                                msg.created_at
                            ).toLocaleTimeString()}{' '}
                        </Text>

                        {renderMessageContent(msg)}
                    </Box>
                ))}
            </Box>

            {/* Input */}
            <Box borderStyle="single" paddingX={1}>
                <Text color="cyan">
    {mode === "code"
        ? `[${language}] `
        : "> "}
</Text>

                <TextInput
                    value={input}
                    onChange={setInput}
                    onSubmit={sendMessage}
                />
            </Box>
        </Box>
    );
};

render(<App />);
