#!/usr/bin/env node

import React, { useEffect, useMemo, useState,useRef } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';

import { getToken, startAuthFlow } from './services/auth.js';
import { connectSocket } from './services/socket.js';

const INDENT = '    ';

const tokenizeCodeLine = (line) => {
    const tokens = [];
    const regex = /(\/\/.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b(?:const|let|var|function|return|if|else|for|while|switch|case|break|continue|true|false|null|undefined|new|class|import|from|export|async|await|try|catch|throw|extends)\b)|(\b\d+(?:\.\d+)?\b)|([{}()[\];,.\-+*/%=<>!?:])/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIndex) {
            tokens.push({ text: line.slice(lastIndex, match.index), color: undefined });
        }

        if (match[1]) tokens.push({ text: match[1], color: 'gray' });
        else if (match[2]) tokens.push({ text: match[2], color: 'green' });
        else if (match[3]) tokens.push({ text: match[3], color: 'cyan' });
        else if (match[4]) tokens.push({ text: match[4], color: 'yellow' });
        else if (match[5]) tokens.push({ text: match[5], color: 'magenta' });

        lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
        tokens.push({ text: line.slice(lastIndex), color: undefined });
    }

    return tokens.length > 0 ? tokens : [{ text: '', color: undefined }];
};

const getIndentForNextLine = (line) => {
    const base = line.match(/^\s*/)?.[0] ?? '';
    const trimmed = line.trimEnd();
    if (/[{[(]$/.test(trimmed)) {
        return base + INDENT;
    }
    return base;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const createEditorState = (initialValue = '') => {
    const lines = initialValue.length > 0 ? initialValue.split('\n') : [''];
    return { lines, row: 0, col: lines[0]?.length ?? 0 };
};

const getEditorText = (editor) => editor.lines.join('\n');

const setCursorToEnd = (lines) => ({
    lines,
    row: lines.length - 1,
    col: lines[lines.length - 1]?.length ?? 0,
});

const insertText = (editor, text) => {
    const lines = [...editor.lines];
    const current = lines[editor.row] ?? '';
    const before = current.slice(0, editor.col);
    const after = current.slice(editor.col);
    const inserted = text.split('\n');

    if (inserted.length === 1) {
        lines[editor.row] = before + text + after;
        return { lines, row: editor.row, col: editor.col + text.length };
    }

    lines[editor.row] = before + inserted[0];
    let targetRow = editor.row;

    for (let i = 1; i < inserted.length; i += 1) {
        targetRow += 1;
        lines.splice(targetRow, 0, inserted[i]);
    }

    lines[targetRow] = lines[targetRow] + after;
    return { lines, row: targetRow, col: inserted[inserted.length - 1].length };
};

const backspace = (editor) => {
    if (editor.col > 0) {
        const lines = [...editor.lines];
        const line = lines[editor.row];
        lines[editor.row] = line.slice(0, editor.col - 1) + line.slice(editor.col);
        return { lines, row: editor.row, col: editor.col - 1 };
    }

    if (editor.row > 0) {
        const lines = [...editor.lines];
        const prevLine = lines[editor.row - 1];
        const current = lines[editor.row];
        const col = prevLine.length;
        lines[editor.row - 1] = prevLine + current;
        lines.splice(editor.row, 1);
        return { lines, row: editor.row - 1, col };
    }

    return editor;
};

const deleteForward = (editor) => {
    const lines = [...editor.lines];
    const line = lines[editor.row];

    if (editor.col < line.length) {
        lines[editor.row] = line.slice(0, editor.col) + line.slice(editor.col + 1);
        return { lines, row: editor.row, col: editor.col };
    }

    if (editor.row < lines.length - 1) {
        lines[editor.row] = line + lines[editor.row + 1];
        lines.splice(editor.row + 1, 1);
        return { lines, row: editor.row, col: editor.col };
    }

    return editor;
};

const moveCursor = (editor, rowDelta, colDelta) => {
    const row = clamp(editor.row + rowDelta, 0, editor.lines.length - 1);
    const col = clamp(editor.col + colDelta, 0, editor.lines[row].length);
    return { ...editor, row, col };
};

const moveHome = (editor) => {
    const line = editor.lines[editor.row];
    const firstContent = line.search(/\S|$/);
    const target = editor.col === firstContent ? 0 : firstContent;
    return { ...editor, col: target };
};

const moveEnd = (editor) => ({
    ...editor,
    col: editor.lines[editor.row].length,
});

const detectBracketPair = (ch) => ({ '(': ')', '[': ']', '{': '}' }[ch]);

const findMatchingBracket = (text, startIndex) => {
    const open = text[startIndex];
    const close = detectBracketPair(open);
    if (!close) return null;

    const direction = 1;
    let depth = 0;
    for (let i = startIndex; i < text.length; i += 1) {
        const ch = text[i];
        if (ch === open) depth += 1;
        if (ch === close) depth -= 1;
        if (depth === 0) return i;
    }
    return null;
};

const App = () => {
    const [token, setToken] = useState(getToken());
    const [socket, setSocket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputMode, setInputMode] = useState('text');
    const [editor, setEditor] = useState(createEditorState(''));
    const [currentChannel, setCurrentChannel] = useState(null);
    const [mode, setMode] = useState('text');
    const [status, setStatus] = useState('');
    const [codeLanguage, setCodeLanguage] = useState('text');
    const lastCursor = useRef(null);
    const { exit } = useApp();
    

    useEffect(() => {
        if (!token) {
            startAuthFlow().then(setToken);
            return;
        }

        const s = connectSocket(token);
        setSocket(s);

        s.on('connect_error', (err) => {
            process.stderr.write(`Connect error: ${err.message}\n`);
            process.stderr.write(`${JSON.stringify(err)}\n`);
        });
        s.on("resume_complete", () => {
    console.log("Replay finished.");
});

       s.on('connect', () => {
    process.stderr.write('Connected!\n');
    s.emit('channels:list');
});

       s.on("channels:list", (channels) => {
    if (channels.length === 0) return;

    const channel = channels[0];

    setCurrentChannel(channel);
    s.emit("channel:join", channel.id);
});
s.on("channel:joined", (channelId) => {
    s.emit("resume", {
        channelId,
        lastCursor: lastCursor.current,
    });
});
s.on('message:new', (msg) => {
    process.stderr.write(JSON.stringify(msg, null, 2) + '\n');

    setMessages((prev) => [...prev.slice(-100), msg]);

    if (
        msg.seq != null &&
        (lastCursor.current == null || msg.seq > lastCursor.current)
    ) {
        lastCursor.current = msg.seq;
    }
});

        return () => s.disconnect();
    }, [token]);

    const handleCommand = (value) => {
        const [cmd, ...args] = value.trim().split(/\s+/);
        switch (cmd.toLowerCase()) {
            case '/code':
                if (args.length === 0) {
                    setStatus('Usage: /code <language>');
                    break;
                }
                setCodeLanguage(args[0].toLowerCase());
                setMode('code');
                setInputMode('code');
                setEditor(createEditorState(''));
                setStatus(`Switched to Code Mode (${args[0]})`);
                break;
            case '/text':
                setMode('text');
                setCodeLanguage('text');
                setInputMode('text');
                setEditor(createEditorState(''));
                setStatus('Switched to Text Mode');
                break;
            default:
                setStatus(`Unknown command: ${cmd}`);
        }
        setTimeout(() => setStatus(''), 2000);
    };

    const sendMessage = (value) => {
        const rawValue = value;
        const trimmed = rawValue.trim();
        if (!trimmed) return;
        if (!socket) {
            process.stderr.write('Socket not ready\n');
            return;
        }
        if (!currentChannel) {
            process.stderr.write('No channel selected\n');
            return;
        }
        if (trimmed.startsWith('/')) {
            handleCommand(trimmed);
            setEditor(createEditorState(''));
            return;
        }

        const payload = {
            channelId: currentChannel.id,
            type: mode === 'code' ? 'code_snippet' : 'text',
            content: rawValue,
            language: mode === 'code' ? codeLanguage : undefined,
        };
        

        socket.emit('message:send', payload);
        setEditor(createEditorState(''));
    };

    const codePreview = useMemo(() => {
        if (mode !== 'code') return null;
        const currentLine = editor.lines[editor.row] ?? '';
        const bracketIndex = editor.col > 0 ? findMatchingBracket(currentLine, editor.col - 1) : null;
        return { currentLine, bracketIndex };
    }, [editor, mode]);

    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            exit();
            return;
        }

        if (inputMode === 'text') {
            if (key.return) {
                sendMessage(getEditorText(editor));
                return;
            }
            if (key.backspace) {
                setEditor(backspace(editor));
                return;
            }
            if (key.leftArrow) {
                setEditor(moveCursor(editor, 0, -1));
                return;
            }
            if (key.rightArrow) {
                setEditor(moveCursor(editor, 0, 1));
                return;
            }
            if (key.upArrow) {
                setEditor(moveCursor(editor, -1, 0));
                return;
            }
            if (key.downArrow) {
                setEditor(moveCursor(editor, 1, 0));
                return;
            }
            if (input) {
                setEditor(insertText(editor, input));
            }
            return;
        }

        if (key.escape) {
            setEditor(createEditorState(''));
            setStatus('Code draft cleared');
            setTimeout(() => setStatus(''), 1200);
            return;
        }

        if (key.ctrl && input === 'd') {
            sendMessage(getEditorText(editor));
            return;
        }

        if (key.return) {
            const currentLine = editor.lines[editor.row] ?? '';
            const before = currentLine.slice(0, editor.col);
            const after = currentLine.slice(editor.col);
            const indentation = getIndentForNextLine(before);
            const nextEditor = insertText(editor, `\n${indentation}`);
            const updatedLines = [...nextEditor.lines];
            updatedLines[nextEditor.row] = updatedLines[nextEditor.row] + after;
            setEditor({
                lines: updatedLines,
                row: nextEditor.row,
                col: indentation.length,
            });
            return;
        }

        if (key.tab) {
            setEditor(insertText(editor, INDENT));
            return;
        }

        if (key.backspace) {
            setEditor(backspace(editor));
            return;
        }

        if (key.delete) {
            setEditor(deleteForward(editor));
            return;
        }

        if (key.leftArrow) {
            if (editor.col > 0) {
                setEditor({ ...editor, col: editor.col - 1 });
                return;
            }
            if (editor.row > 0) {
                const prevRow = editor.row - 1;
                setEditor({
                    ...editor,
                    row: prevRow,
                    col: editor.lines[prevRow].length,
                });
            }
            return;
        }

        if (key.rightArrow) {
            const line = editor.lines[editor.row];
            if (editor.col < line.length) {
                setEditor({ ...editor, col: editor.col + 1 });
                return;
            }
            if (editor.row < editor.lines.length - 1) {
                setEditor({ ...editor, row: editor.row + 1, col: 0 });
            }
            return;
        }

        if (key.upArrow) {
            const row = Math.max(0, editor.row - 1);
            const col = clamp(editor.col, 0, editor.lines[row].length);
            setEditor({ ...editor, row, col });
            return;
        }

        if (key.downArrow) {
            const row = Math.min(editor.lines.length - 1, editor.row + 1);
            const col = clamp(editor.col, 0, editor.lines[row].length);
            setEditor({ ...editor, row, col });
            return;
        }

        if (key.home) {
            setEditor(moveHome(editor));
            return;
        }

        if (key.end) {
            setEditor(moveEnd(editor));
            return;
        }

        if (input) {
            setEditor(insertText(editor, input));
        }
    });

    const renderEditorLine = (line, index) => {
        const isCurrent = index === editor.row;
        const cursorCol = isCurrent ? editor.col : -1;
        const tokens = tokenizeCodeLine(line);

        return (
            <Box key={`editor-line-${index}`}>
                <Text color={isCurrent ? 'cyan' : 'gray'}>
                    {String(index + 1).padStart(3, ' ')} |
                </Text>
                <Text> </Text>
                <Box>
                    {tokens.map((token, tokenIndex) => {
                        const beforeCursor = isCurrent && cursorCol >= 0 && cursorCol <= line.length && token.text.length > 0;
                        return (
                            <Text key={`${index}-${tokenIndex}`} color={token.color}>
                                {token.text}
                            </Text>
                        );
                    })}
                    {isCurrent && cursorCol === line.length ? <Text inverse> </Text> : null}
                </Box>
            </Box>
        );
    };

    const editorBoxHeight = Math.max(4, Math.min(12, process.stdout.rows ? process.stdout.rows - 12 : 8));

    return (
        <Box flexDirection="column" height={process.stdout.rows}>
            <Box borderStyle="single" paddingX={1}>
                <Text bold color="green">
                    ⬡ terminal-chat
                </Text>
                <Text>{' '}— #{currentChannel?.name ?? 'Loading...'}</Text>
            </Box>

            <Text>
                MODE: {mode.toUpperCase()}
                {mode === 'code' && ` (${codeLanguage})`}
            </Text>
            {status && <Text color="green">{status}</Text>}

            <Box flexDirection="column" flexGrow={1} paddingX={1} overflowY="hidden">
                {messages.map((msg) => (
                    <Box key={msg.id} flexDirection="column">
                        <Box>
                            <Text color="cyan" bold>
                                {msg.username}
                            </Text>
                            <Text dimColor>
                                {'  '}
                                {new Date(msg.created_at).toLocaleTimeString()}
                            </Text>
                        </Box>
                        <Box paddingLeft={2}>
                            {msg.type === 'code_snippet' ? (
                                <Box flexDirection="column">
                                    <Text color="yellow" bold>
                                        [{msg.language || 'text'}]
                                    </Text>
                                    <Box borderStyle="round" borderColor="yellow" paddingX={1} flexDirection="column">
                                        {String(msg.content)
                                            .split('\n')
                                            .map((line, index) => (
                                                <Text key={`${msg.id}-code-${index}`} color="yellow">
                                                    {line === '' ? ' ' : line}
                                                </Text>
                                            ))}
                                    </Box>
                                </Box>
                            ) : (
                                <Text>{msg.content}</Text>
                            )}
                        </Box>
                    </Box>
                ))}
            </Box>

            <Box borderStyle="single" paddingX={1} flexDirection="column">
                <Text color="cyan">
                    {mode === 'code' ? `[${codeLanguage}] ` : '> '}
                    {mode === 'code' ? 'Ctrl+D send, Esc clear, Tab indent' : 'Enter send'}
                </Text>
                <Box flexDirection="column" height={editorBoxHeight} overflowY="hidden">
                    {mode === 'code'
                        ? editor.lines.map((line, index) => renderEditorLine(line, index))
                        : (
                            <Box>
                                <Text>{editor.lines[0] ?? ''}</Text>
                                <Text inverse>{' '}</Text>
                            </Box>
                        )}
                </Box>
            </Box>

            {editor.lines.some((line) => line.length > 0) && (
                <Box paddingX={1}>
                    <Text dimColor>
                        Draft: {getEditorText(editor)}
                    </Text>
                </Box>
            )}

            {mode === 'code' && codePreview?.bracketIndex !== null && (
                <Box paddingX={1}>
                    <Text dimColor>
                        Bracket match on line {editor.row + 1}
                    </Text>
                </Box>
            )}
        </Box>
    );
};

render(<App />);
