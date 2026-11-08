import React, { useState, useEffect, useRef, useCallback } from 'react';
import { dia, shapes } from 'jointjs';

// ─── Color constants for state nodes ───────────────────────────────────────────
const COLORS = {
    normal: '#3b3f6b',
    normalStroke: '#5b5fc7',
    start: '#1e3a5f',
    startStroke: '#60a5fa',
    accepting: '#1a3d2e',
    acceptingStroke: '#4ade80',
    startAccepting: '#1e3050',
    startAcceptingStroke: '#818cf8',
    highlighted: '#4c1d3d',
    highlightedStroke: '#f472b6',
    linkDefault: '#6366f1',
    linkHighlight: '#f472b6',
    labelBg: '#1a2240',
    labelBorder: '#6366f1',
    labelText: '#e2e8f0',
};

const DfaNfaVisualizer = () => {
    const paperRef = useRef(null);
    const paperInstance = useRef(null);
    const [graph, setGraph] = useState(null);
    const [stateCounter, setStateCounter] = useState(0);
    const [states, setStates] = useState([]);
    const [transitions, setTransitions] = useState([]);
    const [, setIsAddingTransition] = useState(false);
    const [transitionSource, setTransitionSource] = useState(null);
    const [transitionTarget, setTransitionTarget] = useState(null);
    const [transitionLabel, setTransitionLabel] = useState('');
    const [acceptingStates, setAcceptingStates] = useState(new Set());
    const [testString, setTestString] = useState('');
    const [testResult, setTestResult] = useState(null);
    const [startState, setStartState] = useState(null);
    const [machineType, setMachineType] = useState('');
    const [dfa1, setDfa1] = useState(null);
    const [dfa2, setDfa2] = useState(null);
    const [equivalenceResult, setEquivalenceResult] = useState(null);
    const [showTransitionModal, setShowTransitionModal] = useState(false);
    // equivalence modal reserved for future use

    // ─── Initialize JointJS graph and paper ──────────────────────────────────
    useEffect(() => {
        const newGraph = new dia.Graph({}, { cellNamespace: shapes });
        const paper = new dia.Paper({
            el: paperRef.current,
            width: '100%',
            height: '100%',
            model: newGraph,
            cellViewNamespace: shapes,
            gridSize: 20,
            drawGrid: false,
            interactive: true,
            defaultLink: new shapes.standard.Link(),
            defaultConnectionPoint: { name: 'boundary' },
            validateConnection: () => true,
            background: { color: 'transparent' },
        });

        paper.on('element:pointerdown', function (elementView) {
            elementView.model.toFront();
        });

        paperInstance.current = paper;
        setGraph(newGraph);

        return () => {
            if (paper && typeof paper.remove === 'function') {
                paper.remove();
            }
        };
    }, []);

    // ─── Helper: get fill/stroke for a state node ────────────────────────────
    const getStateColor = useCallback((stateId, stStart, accSet) => {
        const isStart = stateId === stStart;
        const isAccepting = accSet.has(stateId);
        if (isStart && isAccepting) return { fill: COLORS.startAccepting, stroke: COLORS.startAcceptingStroke };
        if (isStart) return { fill: COLORS.start, stroke: COLORS.startStroke };
        if (isAccepting) return { fill: COLORS.accepting, stroke: COLORS.acceptingStroke };
        return { fill: COLORS.normal, stroke: COLORS.normalStroke };
    }, []);

    // ─── Refresh all state visuals ──────────────────────────────────────────
    const refreshStateVisuals = useCallback((statesList, stStart, accSet) => {
        statesList.forEach(s => {
            const c = getStateColor(s.id, stStart, accSet);
            s.node.attr('body/fill', c.fill);
            s.node.attr('body/stroke', c.stroke);
            // Double ring for accepting states
            if (accSet.has(s.id)) {
                s.node.attr('body/strokeWidth', 4);
                s.node.attr('body/strokeDasharray', '');
            } else {
                s.node.attr('body/strokeWidth', 2.5);
            }
        });
    }, [getStateColor]);

    // ─── Set Starting State ──────────────────────────────────────────────────
    const setStartingState = (stateId) => {
        setStartState(stateId);
        refreshStateVisuals(states, stateId, acceptingStates);
    };

    // ─── Toggle Accepting State ──────────────────────────────────────────────
    const toggleAcceptingState = (stateId) => {
        setAcceptingStates(prev => {
            const newSet = new Set(prev);
            if (newSet.has(stateId)) {
                newSet.delete(stateId);
            } else {
                newSet.add(stateId);
            }
            refreshStateVisuals(states, startState, newSet);
            return newSet;
        });
    };

    // ─── Add State ───────────────────────────────────────────────────────────
    const addState = () => {
        if (!graph || !machineType) return;

        const label = `q${stateCounter}`;
        const circlesPerRow = 5;
        const horizontalSpacing = 150;
        const verticalSpacing = 150;
        const startX = 100;
        const startY = 80;

        const x = startX + (stateCounter % circlesPerRow) * horizontalSpacing;
        const y = startY + Math.floor(stateCounter / circlesPerRow) * verticalSpacing;

        const circle = new shapes.standard.Circle();
        circle.position(x, y);
        circle.resize(64, 64);
        circle.attr({
            body: {
                fill: COLORS.normal,
                stroke: COLORS.normalStroke,
                strokeWidth: 2.5,
                cursor: 'move',
            },
            label: {
                text: label,
                fill: COLORS.labelText,
                fontWeight: '600',
                fontSize: 15,
                fontFamily: "'JetBrains Mono', monospace",
                textAnchor: 'middle',
                textVerticalAnchor: 'middle',
                refX: '50%',
                refY: '50%',
            },
        });
        circle.addTo(graph);

        const newStates = [...states, { id: circle.id, label, node: circle }];
        setStates(newStates);
        setStateCounter(stateCounter + 1);

        // Auto-set first state as start state
        if (newStates.length === 1) {
            setStartState(circle.id);
            const c = getStateColor(circle.id, circle.id, acceptingStates);
            circle.attr('body/fill', c.fill);
            circle.attr('body/stroke', c.stroke);
        }
    };

    // ─── Create a styled JointJS link ────────────────────────────────────────
    const createStyledLink = (sourceId, targetId, labelText) => {
        const link = new shapes.standard.Link();
        link.source({ id: sourceId });
        link.target({ id: targetId });

        if (sourceId === targetId) {
            link.router({
                name: 'manhattan',
                args: { padding: 25, startDirections: ['top'], endDirections: ['bottom'] },
            });
            link.connector('rounded');
        } else {
            link.router({
                name: 'manhattan',
                args: {
                    padding: 25,
                    startDirections: ['top', 'left', 'bottom', 'right'],
                    endDirections: ['top', 'left', 'bottom', 'right'],
                },
            });
        }

        link.attr({
            line: {
                stroke: COLORS.linkDefault,
                strokeWidth: 2,
                targetMarker: {
                    type: 'path',
                    d: 'M 12 -6 0 0 12 6 Z',
                    fill: COLORS.linkDefault,
                    stroke: COLORS.linkDefault,
                },
            },
        });

        link.labels([{
            markup: [
                { tagName: 'rect', selector: 'body' },
                { tagName: 'text', selector: 'label' },
            ],
            attrs: {
                label: {
                    text: labelText,
                    fontSize: 13,
                    fontWeight: '600',
                    fontFamily: "'JetBrains Mono', monospace",
                    fill: COLORS.labelText,
                    textAnchor: 'middle',
                    textVerticalAnchor: 'middle',
                },
                body: {
                    fill: COLORS.labelBg,
                    stroke: COLORS.labelBorder,
                    strokeWidth: 1.5,
                    rx: 4,
                    ry: 4,
                    ref: 'label',
                    refWidth: '140%',
                    refHeight: '140%',
                    refX: '-20%',
                    refY: '-20%',
                },
            },
            position: 0.5,
        }]);

        return link;
    };

    // ─── Add Transition (open modal) ─────────────────────────────────────────
    const startAddingTransition = () => {
        setIsAddingTransition(true);
        setTransitionSource(null);
        setTransitionTarget(null);
        setTransitionLabel('');
        setShowTransitionModal(true);
    };

    // ─── Confirm Transition ──────────────────────────────────────────────────
    const confirmTransition = () => {
        if (!graph || !transitionSource || !transitionTarget || !transitionLabel) return;
        if (machineType === 'DFA' && transitionLabel === 'ε') return;

        const sourceState = states.find(state => state.id === transitionSource);
        const targetState = states.find(state => state.id === transitionTarget);

        const existingLink = graph.getLinks().find(link => {
            const sId = link.getSourceElement()?.id;
            const tId = link.getTargetElement()?.id;
            return sId === sourceState.id && tId === targetState.id;
        });

        if (existingLink) {
            const existingLabel = existingLink.labels()[0]?.attrs?.label?.text
                || existingLink.labels()[0]?.attrs?.text?.text || '';
            existingLink.labels([{
                markup: [
                    { tagName: 'rect', selector: 'body' },
                    { tagName: 'text', selector: 'label' },
                ],
                attrs: {
                    label: {
                        text: `${existingLabel}, ${transitionLabel}`,
                        fontSize: 13,
                        fontWeight: '600',
                        fontFamily: "'JetBrains Mono', monospace",
                        fill: COLORS.labelText,
                        textAnchor: 'middle',
                        textVerticalAnchor: 'middle',
                    },
                    body: {
                        fill: COLORS.labelBg,
                        stroke: COLORS.labelBorder,
                        strokeWidth: 1.5,
                        rx: 4, ry: 4,
                        ref: 'label',
                        refWidth: '140%', refHeight: '140%',
                        refX: '-20%', refY: '-20%',
                    },
                },
                position: 0.5,
            }]);
        } else {
            const link = createStyledLink(sourceState.id, targetState.id, transitionLabel);
            link.addTo(graph);
        }

        setTransitions([...transitions, {
            sourceId: sourceState.id,
            source: sourceState.label,
            targetId: targetState.id,
            target: targetState.label,
            label: transitionLabel,
        }]);
        setIsAddingTransition(false);
        setShowTransitionModal(false);
    };

    // ─── Cancel transition modal ─────────────────────────────────────────────
    const cancelTransition = () => {
        setIsAddingTransition(false);
        setShowTransitionModal(false);
        setTransitionSource(null);
        setTransitionTarget(null);
        setTransitionLabel('');
    };

    // ─── Save Machine ────────────────────────────────────────────────────────
    const saveMachine = () => {
        const machineData = {
            machineType,
            startState,
            states: states.map(state => ({
                label: state.label,
                id: state.id,
                x: state.node.position().x,
                y: state.node.position().y,
                isAccepting: acceptingStates.has(state.id),
            })),
            transitions: transitions.map(transition => ({
                sourceId: transition.sourceId,
                targetId: transition.targetId,
                label: transition.label,
                source: transition.source,
                target: transition.target,
            })),
        };

        const blob = new Blob([JSON.stringify(machineData, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${machineType.toLowerCase()}_machine.json`;
        link.click();
    };

    // ─── Render Machine Data (from load or example) ──────────────────────────
    const renderMachineData = (data) => {
        graph.clear();
        setStates([]);
        setTransitions([]);
        setStateCounter(0);
        setAcceptingStates(new Set());

        const stateMap = {};
        const newAcceptingStates = new Set();
        const newStates = [];

        setMachineType(data.machineType);

        data.states.forEach(state => {
            const circle = new shapes.standard.Circle({ id: state.id });
            circle.position(state.x, state.y);
            circle.resize(64, 64);

            const isStart = data.startState === circle.id;
            const isAccepting = state.isAccepting;
            let fill = COLORS.normal, stroke = COLORS.normalStroke;
            if (isStart && isAccepting) { fill = COLORS.startAccepting; stroke = COLORS.startAcceptingStroke; }
            else if (isStart) { fill = COLORS.start; stroke = COLORS.startStroke; }
            else if (isAccepting) { fill = COLORS.accepting; stroke = COLORS.acceptingStroke; }

            circle.attr({
                body: {
                    fill, stroke,
                    strokeWidth: isAccepting ? 4 : 2.5,
                    cursor: 'move',
                },
                label: {
                    text: state.label,
                    fill: COLORS.labelText,
                    fontWeight: '600',
                    fontSize: 15,
                    fontFamily: "'JetBrains Mono', monospace",
                },
            });
            circle.addTo(graph);

            stateMap[state.id] = circle.id;
            if (state.isAccepting) newAcceptingStates.add(circle.id);
            newStates.push({ id: circle.id, label: state.label, node: circle });
        });

        setStates(newStates);
        setStateCounter(data.states.length);
        setAcceptingStates(newAcceptingStates);
        setStartState(data.startState);

        const newTransitions = [];

        data.transitions.forEach(transition => {
            const sourceStateId = stateMap[transition.sourceId];
            const targetStateId = stateMap[transition.targetId];

            if (sourceStateId && targetStateId) {
                const existingLink = graph.getLinks().find(link => {
                    const sId = link.getSourceElement()?.id;
                    const tId = link.getTargetElement()?.id;
                    return sId === sourceStateId && tId === targetStateId;
                });

                if (existingLink) {
                    const existingLabel = existingLink.labels()[0]?.attrs?.label?.text
                        || existingLink.labels()[0]?.attrs?.text?.text || '';
                    existingLink.labels([{
                        markup: [
                            { tagName: 'rect', selector: 'body' },
                            { tagName: 'text', selector: 'label' },
                        ],
                        attrs: {
                            label: {
                                text: `${existingLabel}, ${transition.label}`,
                                fontSize: 13, fontWeight: '600',
                                fontFamily: "'JetBrains Mono', monospace",
                                fill: COLORS.labelText,
                                textAnchor: 'middle', textVerticalAnchor: 'middle',
                            },
                            body: {
                                fill: COLORS.labelBg, stroke: COLORS.labelBorder,
                                strokeWidth: 1.5, rx: 4, ry: 4,
                                ref: 'label', refWidth: '140%', refHeight: '140%',
                                refX: '-20%', refY: '-20%',
                            },
                        },
                        position: 0.5,
                    }]);
                } else {
                    const link = createStyledLink(sourceStateId, targetStateId, transition.label);
                    link.addTo(graph);
                }

                newTransitions.push({
                    sourceId: transition.sourceId,
                    targetId: transition.targetId,
                    label: transition.label,
                    source: transition.source,
                    target: transition.target,
                });
            }
        });

        setTransitions(newTransitions);
    };

    // ─── Load Machine from file ──────────────────────────────────────────────
    const loadMachine = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = JSON.parse(e.target.result);
            renderMachineData(data);
        };
        reader.readAsText(file);
    };

    // ─── Test DFA Input ──────────────────────────────────────────────────────
    const testInput = () => {
        if (!states || !transitions) {
            setTestResult({ accepted: false, message: 'Error: Machine not properly defined', path: [] });
            return;
        }

        const transitionMap = new Map();
        transitions.forEach(t => {
            const key = `${t.source}-${t.label}`;
            transitionMap.set(key, t.target);
        });

        let currentState = states.find(s => s.id === startState)?.label;
        if (!currentState || !states.find(t => t.label === currentState)) {
            setTestResult({ accepted: false, message: 'Error: Start state not defined', path: [] });
            return;
        }

        const path = [currentState];
        for (const symbol of testString) {
            const key = `${currentState}-${symbol}`;
            const targetState = transitionMap.get(key);
            if (!targetState) {
                setTestResult({
                    accepted: false,
                    message: `Rejected — no transition from ${currentState} on "${symbol}"`,
                    path,
                });
                highlightPath(path);
                return;
            }
            currentState = targetState;
            path.push(currentState);
        }

        const isAccepted = acceptingStates.has(states.find(s => s.label === currentState)?.id);
        setTestResult({
            accepted: isAccepted,
            message: isAccepted ? 'Accepted ✓' : 'Rejected — ended in non-accepting state',
            path,
        });
        highlightPath(path);
    };

    // ─── Test NFA Input ──────────────────────────────────────────────────────
    const testNFAInput = () => {
        if (!states || !transitions) {
            setTestResult({ accepted: false, message: 'Error: Machine not properly defined', path: [] });
            return;
        }

        const transitionMap = new Map();
        const epsilonMap = new Map();

        transitions.forEach(t => {
            if (t.label === 'ε') {
                if (!epsilonMap.has(t.source)) epsilonMap.set(t.source, []);
                epsilonMap.get(t.source).push(t.target);
            } else {
                const key = `${t.source}-${t.label}`;
                if (!transitionMap.has(key)) transitionMap.set(key, []);
                transitionMap.get(key).push(t.target);
            }
        });

        const dfs = (currentState, remainingInput, currentPath, visitedEpsilon = new Set()) => {
            if (remainingInput.length === 0) {
                const stateObj = states.find(s => s.label === currentState);
                if (stateObj && acceptingStates.has(stateObj.id)) {
                    return { accepted: true, path: currentPath };
                }
            }

            const epsTargets = epsilonMap.get(currentState) || [];
            for (const target of epsTargets) {
                if (!visitedEpsilon.has(target)) {
                    const result = dfs(target, remainingInput, [...currentPath, target], new Set([...visitedEpsilon, target]));
                    if (result) return result;
                }
            }

            if (remainingInput.length > 0) {
                const symbol = remainingInput[0];
                const restInput = remainingInput.slice(1);
                const nextStates = transitionMap.get(`${currentState}-${symbol}`) || [];
                for (const target of nextStates) {
                    const result = dfs(target, restInput, [...currentPath, target], new Set());
                    if (result) return result;
                }
            }
            return null;
        };

        const startStateLabel = states.find(s => s.id === startState)?.label;
        if (!startStateLabel) {
            setTestResult({ accepted: false, message: 'Error: Start state not defined', path: [] });
            return;
        }

        const inputArray = Array.from(testString);
        const result = dfs(startStateLabel, inputArray, [startStateLabel]);

        if (result) {
            setTestResult({ accepted: true, message: 'Accepted ✓', path: result.path });
            highlightPath(result.path);
        } else {
            setTestResult({ accepted: false, message: 'Rejected — no accepting path found', path: [] });
        }
    };

    // ─── Highlight Path ──────────────────────────────────────────────────────
    const highlightPath = (path) => {
        if (!graph || !states || path.length === 0) return;

        // Reset all
        refreshStateVisuals(states, startState, acceptingStates);
        graph.getLinks().forEach(link => {
            link.attr('line/stroke', COLORS.linkDefault);
            link.attr('line/strokeWidth', 2);
            link.attr('line/targetMarker/fill', COLORS.linkDefault);
            link.attr('line/targetMarker/stroke', COLORS.linkDefault);
        });

        // Highlight path
        for (let i = 0; i < path.length - 1; i++) {
            const currentState = path[i];
            const nextState = path[i + 1];
            const currentNode = states.find(s => s.label === currentState)?.node;
            if (currentNode) {
                currentNode.attr('body/fill', COLORS.highlighted);
                currentNode.attr('body/stroke', COLORS.highlightedStroke);
            }

            const targetNode = states.find(s => s.label === nextState)?.node;
            if (currentNode && targetNode) {
                const link = graph.getLinks().find(l =>
                    l.getSourceElement()?.id === currentNode.id &&
                    l.getTargetElement()?.id === targetNode.id
                );
                if (link) {
                    link.attr('line/stroke', COLORS.linkHighlight);
                    link.attr('line/strokeWidth', 3);
                    link.attr('line/targetMarker/fill', COLORS.linkHighlight);
                    link.attr('line/targetMarker/stroke', COLORS.linkHighlight);
                }
            }
        }

        // Final state
        const finalNode = states.find(s => s.label === path[path.length - 1])?.node;
        if (finalNode) {
            finalNode.attr('body/fill', COLORS.highlighted);
            finalNode.attr('body/stroke', COLORS.highlightedStroke);
        }
    };

    // ─── Reset Highlighting ──────────────────────────────────────────────────
    const resetHighlighting = () => {
        if (!graph || !states) return;
        refreshStateVisuals(states, startState, acceptingStates);
        graph.getLinks().forEach(link => {
            link.attr('line/stroke', COLORS.linkDefault);
            link.attr('line/strokeWidth', 2);
            link.attr('line/targetMarker/fill', COLORS.linkDefault);
            link.attr('line/targetMarker/stroke', COLORS.linkDefault);
        });
    };

    // ─── Load Example Machines ───────────────────────────────────────────────
    const loadExample = (type) => {
        let data;
        if (type === 'DFA_ENDS_WITH_1') {
            data = {
                machineType: 'DFA',
                startState: 'q0_id',
                states: [
                    { id: 'q0_id', label: 'q0', x: 120, y: 200, isAccepting: false },
                    { id: 'q1_id', label: 'q1', x: 360, y: 200, isAccepting: true },
                ],
                transitions: [
                    { sourceId: 'q0_id', targetId: 'q0_id', label: '0', source: 'q0', target: 'q0' },
                    { sourceId: 'q0_id', targetId: 'q1_id', label: '1', source: 'q0', target: 'q1' },
                    { sourceId: 'q1_id', targetId: 'q0_id', label: '0', source: 'q1', target: 'q0' },
                    { sourceId: 'q1_id', targetId: 'q1_id', label: '1', source: 'q1', target: 'q1' },
                ],
            };
        } else if (type === 'NFA_CONTAINS_101') {
            data = {
                machineType: 'NFA',
                startState: 'q0_id',
                states: [
                    { id: 'q0_id', label: 'q0', x: 80, y: 200, isAccepting: false },
                    { id: 'q1_id', label: 'q1', x: 260, y: 200, isAccepting: false },
                    { id: 'q2_id', label: 'q2', x: 440, y: 200, isAccepting: false },
                    { id: 'q3_id', label: 'q3', x: 620, y: 200, isAccepting: true },
                ],
                transitions: [
                    { sourceId: 'q0_id', targetId: 'q0_id', label: '0', source: 'q0', target: 'q0' },
                    { sourceId: 'q0_id', targetId: 'q0_id', label: '1', source: 'q0', target: 'q0' },
                    { sourceId: 'q0_id', targetId: 'q1_id', label: '1', source: 'q0', target: 'q1' },
                    { sourceId: 'q1_id', targetId: 'q2_id', label: '0', source: 'q1', target: 'q2' },
                    { sourceId: 'q2_id', targetId: 'q3_id', label: '1', source: 'q2', target: 'q3' },
                    { sourceId: 'q3_id', targetId: 'q3_id', label: '0', source: 'q3', target: 'q3' },
                    { sourceId: 'q3_id', targetId: 'q3_id', label: '1', source: 'q3', target: 'q3' },
                ],
            };
        } else if (type === 'NFA_EPSILON') {
            data = {
                machineType: 'NFA',
                startState: 'q0_id',
                states: [
                    { id: 'q0_id', label: 'q0', x: 100, y: 200, isAccepting: false },
                    { id: 'q1_id', label: 'q1', x: 300, y: 120, isAccepting: false },
                    { id: 'q2_id', label: 'q2', x: 300, y: 300, isAccepting: false },
                    { id: 'q3_id', label: 'q3', x: 520, y: 200, isAccepting: true },
                ],
                transitions: [
                    { sourceId: 'q0_id', targetId: 'q1_id', label: 'ε', source: 'q0', target: 'q1' },
                    { sourceId: 'q0_id', targetId: 'q2_id', label: 'ε', source: 'q0', target: 'q2' },
                    { sourceId: 'q1_id', targetId: 'q3_id', label: 'a', source: 'q1', target: 'q3' },
                    { sourceId: 'q2_id', targetId: 'q3_id', label: 'b', source: 'q2', target: 'q3' },
                ],
            };
        }
        if (data) renderMachineData(data);
    };

    // ─── DFA Equivalence ─────────────────────────────────────────────────────
    const handleDfaFileUpload = (fileNumber, event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const dfa = JSON.parse(e.target.result);
                    if (fileNumber === 1) setDfa1(dfa);
                    else setDfa2(dfa);
                } catch (error) {
                    alert('Error reading file: ' + error.message);
                }
            };
            reader.readAsText(file);
        }
    };

    const checkDfaEquivalence = () => {
        if (!dfa1 || !dfa2) {
            alert('Please upload both DFA files first');
            return;
        }

        if (dfa1.machineType !== 'DFA' || dfa2.machineType !== 'DFA') {
            setEquivalenceResult({ equivalent: false, message: 'Both machines must be DFAs' });
            return;
        }

        const getTransMap = (dfa) => {
            const map = new Map();
            dfa.transitions.forEach(t => map.set(`${t.sourceId}-${t.label}`, t.targetId));
            return map;
        };

        const transMap1 = getTransMap(dfa1);
        const transMap2 = getTransMap(dfa2);

        const stateMap1 = new Map(dfa1.states.map(s => [s.id, s]));
        const stateMap2 = new Map(dfa2.states.map(s => [s.id, s]));

        const newMachine = { machineType: 'DFA', startState: null, states: [], transitions: [] };

        const alphabet = new Set();
        dfa1.transitions.forEach(t => alphabet.add(t.label));

        let statesToProcess = [];

        const currState1 = stateMap1.get(dfa1.startState);
        const currState2 = stateMap2.get(dfa2.startState);
        const currStatePair = {
            id: `${currState1.id},${currState2.id}`,
            label: `${currState1.label},${currState2.label}`,
            isAccepting: (currState1.isAccepting && !currState2.isAccepting) || (!currState1.isAccepting && currState2.isAccepting),
        };

        newMachine.startState = currStatePair;
        newMachine.states.push(currStatePair);
        statesToProcess.push([currState1, currState2]);

        const processedPairs = new Map();
        processedPairs.set(currStatePair.id, currStatePair);

        while (statesToProcess.length > 0) {
            const [s1, s2] = statesToProcess.pop();
            const currentPair = processedPairs.get(`${s1.id},${s2.id}`);

            alphabet.forEach(letter => {
                const nextId1 = transMap1.get(`${s1.id}-${letter}`);
                const nextId2 = transMap2.get(`${s2.id}-${letter}`);

                if (nextId1 && nextId2) {
                    const nextState1 = stateMap1.get(nextId1);
                    const nextState2 = stateMap2.get(nextId2);

                    const nextStatePair = {
                        id: `${nextState1.id},${nextState2.id}`,
                        label: `${nextState1.label},${nextState2.label}`,
                        isAccepting: (nextState1.isAccepting && !nextState2.isAccepting) || (!nextState1.isAccepting && nextState2.isAccepting),
                    };

                    const newTransition = { sourceId: currentPair.id, targetId: nextStatePair.id, label: letter };

                    if (!processedPairs.has(nextStatePair.id)) {
                        processedPairs.set(nextStatePair.id, nextStatePair);
                        newMachine.states.push(nextStatePair);
                        statesToProcess.push([nextState1, nextState2]);
                    }
                    newMachine.transitions.push(newTransition);
                }
            });
        }

        let queue = [newMachine.startState];
        let visited = new Set([newMachine.startState.id]);

        while (queue.length > 0) {
            const currentState = queue.shift();
            if (currentState.isAccepting) {
                setEquivalenceResult({
                    equivalent: false,
                    message: `Not equivalent — distinguishing state: ${currentState.label}`,
                });
                return;
            }

            const stateTransitions = newMachine.transitions.filter(t => t.sourceId === currentState.id);
            stateTransitions.forEach(transition => {
                const targetState = newMachine.states.find(s => s.id === transition.targetId);
                if (targetState && !visited.has(targetState.id)) {
                    visited.add(targetState.id);
                    queue.push(targetState);
                }
            });
        }

        setEquivalenceResult({ equivalent: true, message: 'The DFAs are equivalent ✓' });
    };

    // ─── NFA to DFA Conversion ───────────────────────────────────────────────
    const convertNfaToDfa = () => {
        if (machineType !== 'NFA' || !startState) {
            alert('Please select NFA mode and ensure a start state is set.');
            return;
        }

        const transitionMap = new Map();
        const epsilonMap = new Map();
        const alphabet = new Set();

        transitions.forEach(t => {
            if (t.label === 'ε') {
                if (!epsilonMap.has(t.sourceId)) epsilonMap.set(t.sourceId, []);
                epsilonMap.get(t.sourceId).push(t.targetId);
            } else {
                alphabet.add(t.label);
                const key = `${t.sourceId}-${t.label}`;
                if (!transitionMap.has(key)) transitionMap.set(key, []);
                transitionMap.get(key).push(t.targetId);
            }
        });

        const getEpsilonClosure = (stateIds) => {
            const closure = new Set(stateIds);
            const stack = [...stateIds];
            while (stack.length > 0) {
                const current = stack.pop();
                const eps = epsilonMap.get(current) || [];
                eps.forEach(nextState => {
                    if (!closure.has(nextState)) {
                        closure.add(nextState);
                        stack.push(nextState);
                    }
                });
            }
            return Array.from(closure).sort();
        };

        const initialClosure = getEpsilonClosure([startState]);
        const closureKey = (arr) => arr.join(',');

        const visitedClosures = new Set();
        const queue = [initialClosure];
        visitedClosures.add(closureKey(initialClosure));

        const dfaStates = [];
        const dfaTransitions = [];
        const stateMapConvert = new Map();

        let stateIdCounter = 0;

        const getOrCreateDfaState = (closure) => {
            const key = closureKey(closure);
            if (stateMapConvert.has(key)) return stateMapConvert.get(key);

            const isAccepting = closure.some(id => acceptingStates.has(id));
            const labels = closure.map(id => states.find(s => s.id === id)?.label).filter(Boolean);
            const label = `{${labels.join(',')}}` || `S${stateIdCounter}`;

            const newState = { id: `dfa_s${stateIdCounter++}`, label, closure, isAccepting };
            stateMapConvert.set(key, newState);
            dfaStates.push(newState);
            return newState;
        };

        const startDfaState = getOrCreateDfaState(initialClosure);

        while (queue.length > 0) {
            const currentClosure = queue.shift();
            const currentDfaState = getOrCreateDfaState(currentClosure);

            alphabet.forEach(symbol => {
                const moveTargets = new Set();
                currentClosure.forEach(stateId => {
                    const targets = transitionMap.get(`${stateId}-${symbol}`) || [];
                    targets.forEach(t => moveTargets.add(t));
                });

                if (moveTargets.size > 0) {
                    const nextClosure = getEpsilonClosure(Array.from(moveTargets));
                    const key = closureKey(nextClosure);
                    const nextDfaState = getOrCreateDfaState(nextClosure);

                    dfaTransitions.push({
                        sourceId: currentDfaState.id,
                        targetId: nextDfaState.id,
                        label: symbol,
                        source: currentDfaState.label,
                        target: nextDfaState.label,
                    });

                    if (!visitedClosures.has(key)) {
                        visitedClosures.add(key);
                        queue.push(nextClosure);
                    }
                }
            });
        }

        // Render the DFA
        graph.clear();
        setStates([]);
        setTransitions([]);
        setStateCounter(0);
        setAcceptingStates(new Set());
        setStartState(null);
        setMachineType('DFA');

        const circlesPerRow = 5;
        const horizontalSpacing = 150;
        const verticalSpacing = 150;
        const startX = 100;
        const startY = 80;

        const newStates = [];
        const newAccepting = new Set();

        dfaStates.forEach((st, idx) => {
            const x = startX + (idx % circlesPerRow) * horizontalSpacing;
            const y = startY + Math.floor(idx / circlesPerRow) * verticalSpacing;

            const circle = new shapes.standard.Circle({ id: st.id });
            circle.position(x, y);
            circle.resize(64, 64);

            const isStart = st.id === startDfaState.id;
            let fill = COLORS.normal, stroke = COLORS.normalStroke;
            if (isStart && st.isAccepting) { fill = COLORS.startAccepting; stroke = COLORS.startAcceptingStroke; }
            else if (isStart) { fill = COLORS.start; stroke = COLORS.startStroke; }
            else if (st.isAccepting) { fill = COLORS.accepting; stroke = COLORS.acceptingStroke; }

            circle.attr({
                body: { fill, stroke, strokeWidth: st.isAccepting ? 4 : 2.5, cursor: 'move' },
                label: {
                    text: st.label, fill: COLORS.labelText,
                    fontWeight: '600', fontSize: 13,
                    fontFamily: "'JetBrains Mono', monospace",
                },
            });
            circle.addTo(graph);

            if (st.isAccepting) newAccepting.add(st.id);
            newStates.push({ id: st.id, label: st.label, node: circle });
        });

        setStates(newStates);
        setStateCounter(dfaStates.length);
        setAcceptingStates(newAccepting);
        setStartState(startDfaState.id);

        const linkMap = new Map();
        dfaTransitions.forEach(tr => {
            const key = `${tr.sourceId}->${tr.targetId}`;
            if (!linkMap.has(key)) linkMap.set(key, { ...tr, labels: [] });
            linkMap.get(key).labels.push(tr.label);
        });

        const newTransitions = [];

        linkMap.forEach((trInfo) => {
            const combinedLabel = trInfo.labels.join(', ');
            const link = createStyledLink(trInfo.sourceId, trInfo.targetId, combinedLabel);
            link.addTo(graph);

            trInfo.labels.forEach(lbl => {
                newTransitions.push({
                    sourceId: trInfo.sourceId,
                    targetId: trInfo.targetId,
                    label: lbl,
                    source: dfaStates.find(s => s.id === trInfo.sourceId)?.label,
                    target: dfaStates.find(s => s.id === trInfo.targetId)?.label,
                });
            });
        });

        setTransitions(newTransitions);
    };

    // ─── DFA Minimization (Hopcroft's Algorithm) ─────────────────────────────
    const minimizeDfa = () => {
        if (machineType !== 'DFA' || !startState) {
            alert('Please ensure you have a DFA with a start state.');
            return;
        }

        // Build transition map
        const alphabet = new Set();
        transitions.forEach(t => alphabet.add(t.label));
        const transMap = new Map();
        transitions.forEach(t => {
            transMap.set(`${t.sourceId}-${t.label}`, t.targetId);
        });

        // Partition refinement
        const accepting = Array.from(acceptingStates);
        const nonAccepting = states.filter(s => !acceptingStates.has(s.id)).map(s => s.id);

        let partitions = [];
        if (accepting.length > 0) partitions.push(new Set(accepting));
        if (nonAccepting.length > 0) partitions.push(new Set(nonAccepting));

        let changed = true;
        while (changed) {
            changed = false;
            const newPartitions = [];
            for (const partition of partitions) {
                const splits = new Map();
                for (const stateId of partition) {
                    const sig = [];
                    for (const symbol of alphabet) {
                        const target = transMap.get(`${stateId}-${symbol}`);
                        const partIdx = target ? partitions.findIndex(p => p.has(target)) : -1;
                        sig.push(partIdx);
                    }
                    const key = sig.join(',');
                    if (!splits.has(key)) splits.set(key, new Set());
                    splits.get(key).add(stateId);
                }
                if (splits.size > 1) changed = true;
                splits.forEach(s => newPartitions.push(s));
            }
            partitions = newPartitions;
        }

        // Build minimized DFA
        const minStates = [];
        const minTransitions = [];
        const partitionMap = new Map(); // stateId -> partition index

        partitions.forEach((partition, idx) => {
            for (const stateId of partition) {
                partitionMap.set(stateId, idx);
            }
            const isAccepting = partition.has(Array.from(acceptingStates).find(a => partition.has(a)));
            const isStart = partition.has(startState);

            minStates.push({
                id: `min_q${idx}`,
                label: `q${idx}`,
                isAccepting: !!isAccepting,
                isStart,
            });
        });

        const addedTransitions = new Set();
        for (const stateId of states.map(s => s.id)) {
            const fromPartition = partitionMap.get(stateId);
            for (const symbol of alphabet) {
                const target = transMap.get(`${stateId}-${symbol}`);
                if (target) {
                    const toPartition = partitionMap.get(target);
                    const key = `${fromPartition}-${symbol}-${toPartition}`;
                    if (!addedTransitions.has(key)) {
                        addedTransitions.add(key);
                        minTransitions.push({
                            sourceId: `min_q${fromPartition}`,
                            targetId: `min_q${toPartition}`,
                            label: symbol,
                            source: `q${fromPartition}`,
                            target: `q${toPartition}`,
                        });
                    }
                }
            }
        }

        const startPartition = partitionMap.get(startState);
        const data = {
            machineType: 'DFA',
            startState: `min_q${startPartition}`,
            states: minStates.map((s, idx) => ({
                id: s.id,
                label: s.label,
                x: 100 + (idx % 5) * 150,
                y: 80 + Math.floor(idx / 5) * 150,
                isAccepting: s.isAccepting,
            })),
            transitions: minTransitions,
        };

        renderMachineData(data);
    };

    // ─── Clear Machine ───────────────────────────────────────────────────────
    const clearMachine = () => {
        if (!graph) return;
        graph.clear();
        setStates([]);
        setTransitions([]);
        setStateCounter(0);
        setAcceptingStates(new Set());
        setStartState(null);
        setTestString('');
        setTestResult(null);
        setDfa1(null);
        setDfa2(null);
        setEquivalenceResult(null);
        setMachineType('');
    };

    // ─── Delete a single state ───────────────────────────────────────────────
    const deleteState = (stateId) => {
        const stateObj = states.find(s => s.id === stateId);
        if (!stateObj) return;

        // Remove from graph
        stateObj.node.remove();

        // Remove transitions involving this state
        const linksToRemove = graph.getLinks().filter(link => {
            const sId = link.getSourceElement()?.id;
            const tId = link.getTargetElement()?.id;
            return sId === stateId || tId === stateId;
        });
        linksToRemove.forEach(l => l.remove());

        setStates(prev => prev.filter(s => s.id !== stateId));
        setTransitions(prev => prev.filter(t => t.sourceId !== stateId && t.targetId !== stateId));
        setAcceptingStates(prev => {
            const newSet = new Set(prev);
            newSet.delete(stateId);
            return newSet;
        });
        if (startState === stateId) setStartState(null);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // ─── RENDER ──────────────────────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════════════

    return (
        <div className="main-content">
            {/* ─── Sidebar ──────────────────────────────────────────────── */}
            <aside className="sidebar">
                {/* Machine Type Selection */}
                <div className="sidebar-section">
                    <div className="section-header">
                        <div className="section-icon purple">⚙</div>
                        <span className="section-title">Machine Type</span>
                    </div>
                    <div className="machine-type-selector">
                        <button
                            className={`type-btn ${machineType === 'DFA' ? 'active' : ''}`}
                            onClick={() => setMachineType('DFA')}
                        >
                            DFA
                        </button>
                        <button
                            className={`type-btn ${machineType === 'NFA' ? 'active' : ''}`}
                            onClick={() => setMachineType('NFA')}
                        >
                            NFA
                        </button>
                    </div>
                </div>

                {/* Actions */}
                <div className="sidebar-section">
                    <div className="section-header">
                        <div className="section-icon blue">◆</div>
                        <span className="section-title">Actions</span>
                    </div>
                    <div className="action-grid">
                        <button className="action-btn primary" onClick={addState} disabled={!machineType}>
                            + Add State
                        </button>
                        <button className="action-btn primary" onClick={startAddingTransition} disabled={!machineType || states.length < 2}>
                            ⟶ Transition
                        </button>
                        <button className="action-btn" onClick={saveMachine} disabled={states.length === 0}>
                            ↓ Save
                        </button>
                        <button className="action-btn" onClick={() => document.getElementById('fileInput').click()}>
                            ↑ Load
                        </button>
                        <input type="file" onChange={loadMachine} accept=".json" style={{ display: 'none' }} id="fileInput" />
                        {machineType === 'NFA' && (
                            <button className="action-btn success full-width" onClick={convertNfaToDfa}>
                                ⟹ Convert NFA → DFA
                            </button>
                        )}
                        {machineType === 'DFA' && (
                            <button className="action-btn warning full-width" onClick={minimizeDfa} disabled={states.length === 0}>
                                ⊡ Minimize DFA
                            </button>
                        )}
                        <button className="action-btn danger full-width" onClick={clearMachine}>
                            ✕ Clear All
                        </button>
                    </div>
                </div>

                {/* Examples */}
                <div className="sidebar-section">
                    <div className="section-header">
                        <div className="section-icon green">★</div>
                        <span className="section-title">Examples</span>
                    </div>
                    <div className="example-btns">
                        <button className="action-btn" onClick={() => loadExample('DFA_ENDS_WITH_1')}>
                            DFA: ends with 1
                        </button>
                        <button className="action-btn" onClick={() => loadExample('NFA_CONTAINS_101')}>
                            NFA: contains 101
                        </button>
                        <button className="action-btn" onClick={() => loadExample('NFA_EPSILON')}>
                            NFA: ε-transitions
                        </button>
                    </div>
                </div>

                {/* Start State Selection */}
                {states.length > 0 && (
                    <div className="sidebar-section">
                        <div className="section-header">
                            <div className="section-icon blue">▶</div>
                            <span className="section-title">Start State</span>
                        </div>
                        <select
                            className="select-field"
                            value={startState || ''}
                            onChange={(e) => setStartingState(e.target.value)}
                        >
                            <option value="">Select start state…</option>
                            {states.map(state => (
                                <option key={state.id} value={state.id}>{state.label}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* States List */}
                {states.length > 0 && (
                    <div className="sidebar-section">
                        <div className="section-header">
                            <div className="section-icon purple">●</div>
                            <span className="section-title">States ({states.length})</span>
                        </div>
                        <div className="state-list">
                            {states.map(state => (
                                <div key={state.id} className="state-item">
                                    <div className={`state-dot ${state.id === startState ? 'start' : acceptingStates.has(state.id) ? 'accepting' : 'normal'}`} />
                                    <span className="state-name">{state.label}</span>
                                    <div className="state-badges">
                                        {state.id === startState && <span className="badge start-badge">start</span>}
                                        {acceptingStates.has(state.id) && <span className="badge accept-badge">accept</span>}
                                    </div>
                                    <div className="state-actions">
                                        <button
                                            className="state-action-btn"
                                            onClick={() => toggleAcceptingState(state.id)}
                                            title={acceptingStates.has(state.id) ? 'Remove accepting' : 'Mark accepting'}
                                        >
                                            {acceptingStates.has(state.id) ? '◉' : '○'}
                                        </button>
                                        <button
                                            className="state-action-btn"
                                            onClick={() => deleteState(state.id)}
                                            title="Delete state"
                                            style={{ color: '#f87171' }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Transitions List */}
                {transitions.length > 0 && (
                    <div className="sidebar-section">
                        <div className="section-header">
                            <div className="section-icon orange">⟶</div>
                            <span className="section-title">Transitions ({transitions.length})</span>
                        </div>
                        <div className="transition-list">
                            {transitions.map((t, index) => (
                                <div key={index} className="transition-item">
                                    <span>{t.source}</span>
                                    <span className="transition-arrow">→</span>
                                    <span className="transition-label-badge">{t.label}</span>
                                    <span className="transition-arrow">→</span>
                                    <span>{t.target}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* DFA Equivalence */}
                <div className="sidebar-section">
                    <div className="section-header">
                        <div className="section-icon red">≡</div>
                        <span className="section-title">DFA Equivalence</span>
                    </div>
                    <div className="equivalence-section">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                            <label className="file-upload-label">
                                DFA 1: {dfa1 ? '✓ loaded' : 'no file'}
                                <input
                                    type="file"
                                    onChange={(e) => handleDfaFileUpload(1, e)}
                                    accept=".json"
                                    style={{ display: 'none' }}
                                />
                                <div className={`file-upload-area`}>
                                    {dfa1 ? `${dfa1.states?.length || 0} states` : 'Click to upload JSON'}
                                </div>
                            </label>
                            <label className="file-upload-label">
                                DFA 2: {dfa2 ? '✓ loaded' : 'no file'}
                                <input
                                    type="file"
                                    onChange={(e) => handleDfaFileUpload(2, e)}
                                    accept=".json"
                                    style={{ display: 'none' }}
                                />
                                <div className={`file-upload-area`}>
                                    {dfa2 ? `${dfa2.states?.length || 0} states` : 'Click to upload JSON'}
                                </div>
                            </label>
                        </div>
                        <button
                            className="action-btn primary full-width"
                            onClick={checkDfaEquivalence}
                            disabled={!dfa1 || !dfa2}
                        >
                            Check Equivalence
                        </button>
                        {equivalenceResult && (
                            <div className={`result-toast ${equivalenceResult.equivalent ? 'accepted' : 'rejected'}`} style={{ position: 'relative', marginTop: '8px' }}>
                                <span className="result-icon">{equivalenceResult.equivalent ? '✓' : '✗'}</span>
                                <span>{equivalenceResult.message}</span>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* ─── Canvas Area ──────────────────────────────────────────── */}
            <div className="canvas-area">
                {/* Toolbar */}
                <div className="canvas-toolbar">
                    <span className="toolbar-badge">
                        {machineType || 'No type'} · {states.length} states · {transitions.length} δ
                    </span>
                    <div className="toolbar-divider" />
                    {machineType === 'NFA' && (
                        <button
                            className="action-btn"
                            onClick={() => {
                                setTransitionLabel('ε');
                            }}
                            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                            title="Insert epsilon symbol"
                        >
                            ε epsilon
                        </button>
                    )}
                    <div style={{ flex: 1 }} />
                    {startState && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Start: <strong style={{ color: 'var(--accent-secondary)' }}>{states.find(s => s.id === startState)?.label}</strong>
                        </span>
                    )}
                </div>

                {/* Canvas */}
                <div className="canvas-wrapper">
                    <div ref={paperRef} style={{ width: '100%', height: '100%', minHeight: '600px' }} />

                    {states.length === 0 && (
                        <div className="empty-state">
                            <div className="empty-state-icon">◎</div>
                            <div className="empty-state-text">No states yet</div>
                            <div className="empty-state-hint">
                                {machineType
                                    ? 'Click "Add State" to begin building your automaton'
                                    : 'Select a machine type (DFA or NFA) to get started'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Test Panel (floating at bottom) */}
                {states.length > 0 && startState && (
                    <div className="test-panel">
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            Test:
                        </span>
                        <input
                            className="test-input"
                            type="text"
                            value={testString}
                            onChange={(e) => {
                                resetHighlighting();
                                setTestString(e.target.value);
                                setTestResult(null);
                            }}
                            placeholder="Enter input string…"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    if (machineType === 'DFA') testInput();
                                    else testNFAInput();
                                }
                            }}
                        />
                        <button
                            className="test-btn"
                            onClick={machineType === 'DFA' ? testInput : testNFAInput}
                        >
                            Run ▶
                        </button>
                    </div>
                )}

                {/* Result Toast */}
                {testResult && (
                    <div className={`result-toast ${testResult.accepted ? 'accepted' : 'rejected'}`}>
                        <span className="result-icon">{testResult.accepted ? '✓' : '✗'}</span>
                        <div>
                            <div>{testResult.message}</div>
                            {testResult.path && testResult.path.length > 0 && (
                                <div className="result-path">
                                    Path: {testResult.path.join(' → ')}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Transition Modal ─────────────────────────────────────── */}
            {showTransitionModal && (
                <div className="modal-overlay" onClick={cancelTransition}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">Add Transition</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Source State</label>
                                <select
                                    className="select-field"
                                    onChange={(e) => setTransitionSource(e.target.value)}
                                    value={transitionSource || ''}
                                >
                                    <option value="">Select source…</option>
                                    {states.map(state => (
                                        <option key={state.id} value={state.id}>{state.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Target State</label>
                                <select
                                    className="select-field"
                                    onChange={(e) => setTransitionTarget(e.target.value)}
                                    value={transitionTarget || ''}
                                >
                                    <option value="">Select target…</option>
                                    {states.map(state => (
                                        <option key={state.id} value={state.id}>{state.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                                    Symbol
                                    {machineType === 'NFA' && (
                                        <button className="epsilon-btn" onClick={() => setTransitionLabel('ε')} style={{ marginLeft: '8px' }}>
                                            ε
                                        </button>
                                    )}
                                </label>
                                <input
                                    className="input-field"
                                    type="text"
                                    placeholder="e.g. 0, 1, a, b"
                                    value={transitionLabel}
                                    onChange={(e) => setTransitionLabel(e.target.value)}
                                    maxLength="1"
                                />
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button className="action-btn" onClick={cancelTransition}>
                                Cancel
                            </button>
                            <button
                                className="action-btn primary"
                                onClick={confirmTransition}
                                disabled={!transitionSource || !transitionTarget || !transitionLabel}
                            >
                                Add Transition
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DfaNfaVisualizer;
