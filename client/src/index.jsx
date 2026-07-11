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

    const language = msg.language || "text";
    const content = msg.content;

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
    
    const [status, setStatus] = useState("");
    const [codeLanguage, setCodeLanguage] = useState("text");
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
    
    const handleCommand = (input) => {
    const [cmd, ...args] = input.trim().split(/\s+/);

    switch (cmd.toLowerCase()) {
        case "/code":
            if (args.length === 0) {
                setStatus("Usage: /code <language>");
                break;
            }

            setCodeLanguage(args[0].toLowerCase());
            setMode("code");
            setStatus(`Switched to Code Mode (${args[0]})`);
            break;

        case "/text":
            setMode("text");
            setCodeLanguage("text");
            setStatus("Switched to Text Mode");
            break;

        default:
            setStatus(`Unknown command: ${cmd}`);
    }

    setTimeout(() => setStatus(""), 2000);
};
    const sendMessage = (value) => {
    const trimmed = value.trim();

    if (!trimmed) return;

    if (!socket) {
        process.stderr.write("Socket not ready\n");
        return;
    }

    if (!currentChannel) {
        process.stderr.write("No channel selected\n");
        return;
    }

    // Handle commands
    if (trimmed.startsWith("/")) {
        handleCommand(trimmed);
        setInput("");
        return;
    }

    const payload = {
        channelId: currentChannel.id,
        type: mode === "code" ? "code_snippet" : "text",
        content: trimmed,
        language: mode === "code" ? codeLanguage : undefined
    };

    socket.emit("chat_message", payload);

    setInput("");

    // Return to text mode after sending code
    if (mode === "code") {
        setMode("text");
        setCodeLanguage("text");
    }
};


    

useInput((input, key) => {
    if (key.ctrl && input === "c") {
        exit();
        return;
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
            <Text>
    MODE: {mode.toUpperCase()}
    {mode === "code" && ` (${codeLanguage})`}
</Text>
{status && (
    <Text color="green">
        {status}
    </Text>
)}

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
        ? `[${codeLanguage}] `
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
