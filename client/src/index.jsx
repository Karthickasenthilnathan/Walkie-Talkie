#!/usr/bin/env node

import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';

import { getToken, startAuthFlow } from './services/auth.js';
import { connectSocket } from './services/socket.js';

const App = () => {
    const [token, setToken] = useState(getToken());
    const [socket, setSocket] = useState(null);
    const [messages, setMessages] = useState([]);

    const [input, setInput] = useState('');
    const [currentChannel, setCurrentChannel] = useState(null);
    const { exit } = useApp();

    useEffect(() => {
        if (!token) {
            startAuthFlow().then(setToken);
            return;
        }

        const s = connectSocket(token);

        setSocket(s);

        s.on('message:new', (msg) => {
            setMessages((prev) => [...prev.slice(-100), msg]);
        });

        return () => s.disconnect();
    }, [token]);

    const sendMessage = (value) => {
        if (!value.trim() || !socket) return;

        const isCode = value.startsWith('```');

        socket.emit('message:send', {
            channelId: currentChannel.id,
            content: isCode
                ? value
                      .replace(/```(\w*)\n?/, '')
                      .replace(/```$/, '')
                : value,
            type: isCode ? 'code_snippet' : 'text',
            language: isCode
                ? (value.match(/```(\w+)/) || [])[1]
                : null,
        });

        setInput('');
    };

    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            exit();
        }
    });

    return (
        <Box flexDirection="column" height={process.stdout.rows}>
            {/* Header */}
            <Box borderStyle="single" paddingX={1}>
                <Text bold color="green">
                    ⬡ terminal-chat
                </Text>
                <Text> — #{currentChannel}</Text>
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

                        {msg.type === 'code_snippet' ? (
                            <Text color="yellow">
                                [{msg.language || 'code'}] {msg.content}
                            </Text>
                        ) : (
                            <Text>{msg.content}</Text>
                        )}
                    </Box>
                ))}
            </Box>

            {/* Input */}
            <Box borderStyle="single" paddingX={1}>
                <Text color="green">❯ </Text>

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