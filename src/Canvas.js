import React, { useState, useEffect, useRef, useCallback } from 'react';
import { dia, shapes } from 'jointjs';
import {
    FaPlay, FaPause, FaStepForward, FaStepBackward, FaRedo,
    FaPlus, FaTrash, FaCheck, FaTimes, FaSearchPlus, FaSearchMinus,
    FaArrowsAlt, FaTable, FaProjectDiagram, FaExchangeAlt, FaFileDownload, FaFileUpload
} from 'react-icons/fa';

// ─── Theme Colors for Nodes & Links ──────────────────────────────────────────
const COLORS = {
    normal: '#272d4a',
    normalStroke: '#4f568a',
    start: '#1e3a5f',
    startStroke: '#60a5fa',
    accepting: '#133e2c',
    acceptingStroke: '#34d399',
    startAccepting: '#1e3050',
    startAcceptingStroke: '#818cf8',
    activeCurrent: '#701a45',
    activeCurrentStroke: '#f472b6',
    pathVisited: '#312e81',
    pathVisitedStroke: '#818cf8',
    linkDefault: '#6366f1',
    linkHighlight: '#f472b6',
    labelBg: '#13182e',
    labelBorder: '#6366f1',
    labelText: '#f1f5f9',
};

const DfaNfaVisualizer = () => {
    const paperRef = useRef(null);
    const paperInstance = useRef(null);
    const [graph, setGraph] = useState(null);

    // Automata State
    const [machineType, setMachineType] = useState('DFA');
    const [stateCounter, setStateCounter] = useState(0);
    const [states, setStates] = useState([]);
    const [transitions, setTransitions] = useState([]);
    const [startState, setStartState] = useState(null);
    const [acceptingStates, setAcceptingStates] = useState(new Set());

    // Transition Modal
    const [showTransitionModal, setShowTransitionModal] = useState(false);
    const [transitionSource, setTransitionSource] = useState('');
    const [transitionTarget, setTransitionTarget] = useState('');
    const [transitionLabel, setTransitionLabel] = useState('');

    // Testing & Simulation
    const [testString, setTestString] = useState('');
    const [testResult, setTestResult] = useState(null);
    const [simulationSteps, setSimulationSteps] = useState([]); // [{ state, symbol, linkKey }]
    const [currentStepIndex, setCurrentStepIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const playTimerRef = useRef(null);

    // Sidebar Tab: 'build' | 'table' | 'equivalence'
    const [activeTab, setActiveTab] = useState('build');

    // Equivalence Checker Files
    const [dfa1, setDfa1] = useState(null);
    const [dfa2, setDfa2] = useState(null);
    const [equivalenceResult, setEquivalenceResult] = useState(null);

    // Canvas Zoom
    const [zoomLevel, setZoomLevel] = useState(1);

    // ─── Initialize JointJS ──────────────────────────────────────────────────
    useEffect(() => {
        const newGraph = new dia.Graph({}, { cellNamespace: shapes });
        const paper = new dia.Paper({
            el: paperRef.current,
            width: '100%',
            height: '100%',
            model: newGraph,
            cellViewNamespace: shapes,
            gridSize: 15,
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

    // ─── Node Coloring Helper ────────────────────────────────────────────────
    const getStateColor = useCallback((stateId, stStart, accSet, activeCurrentId = null) => {
        if (stateId === activeCurrentId) {
            return { fill: COLORS.activeCurrent, stroke: COLORS.activeCurrentStroke };
        }
        const isStart = stateId === stStart;
        const isAccepting = accSet.has(stateId);
        if (isStart && isAccepting) return { fill: COLORS.startAccepting, stroke: COLORS.startAcceptingStroke };
        if (isStart) return { fill: COLORS.start, stroke: COLORS.startStroke };
        if (isAccepting) return { fill: COLORS.accepting, stroke: COLORS.acceptingStroke };
        return { fill: COLORS.normal, stroke: COLORS.normalStroke };
    }, []);

    // ─── Refresh All State Visuals ──────────────────────────────────────────
    const refreshStateVisuals = useCallback((statesList, stStart, accSet, activeCurrentId = null) => {
        statesList.forEach(s => {
            const c = getStateColor(s.id, stStart, accSet, activeCurrentId);
            s.node.attr('body/fill', c.fill);
            s.node.attr('body/stroke', c.stroke);
            if (accSet.has(s.id)) {
                s.node.attr('body/strokeWidth', 4);
            } else {
                s.node.attr('body/strokeWidth', 2.5);
            }
        });
    }, [getStateColor]);

    // ─── Start State Selection ───────────────────────────────────────────────
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
        if (!graph) return;

        const label = `q${stateCounter}`;
        const circlesPerRow = 5;
        const horizontalSpacing = 140;
        const verticalSpacing = 140;
        const startX = 100;
        const startY = 80;

        const x = startX + (stateCounter % circlesPerRow) * horizontalSpacing;
        const y = startY + Math.floor(stateCounter / circlesPerRow) * verticalSpacing;

        const circle = new shapes.standard.Circle();
        circle.position(x, y);
        circle.resize(60, 60);
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

        if (newStates.length === 1) {
            setStartState(circle.id);
            const c = getStateColor(circle.id, circle.id, acceptingStates);
            circle.attr('body/fill', c.fill);
            circle.attr('body/stroke', c.stroke);
        }
    };

    // ─── Delete State ────────────────────────────────────────────────────────
    const deleteState = (stateId) => {
        const stateObj = states.find(s => s.id === stateId);
        if (!stateObj) return;

        stateObj.node.remove();

        const linksToRemove = graph.getLinks().filter(link => {
            const sId = link.getSourceElement()?.id;
            const tId = link.getTargetElement()?.id;
            return sId === stateId || tId === stateId;
        });
        linksToRemove.forEach(l => l.remove());

        const remainingStates = states.filter(s => s.id !== stateId);
        const remainingTransitions = transitions.filter(t => t.sourceId !== stateId && t.targetId !== stateId);

        setStates(remainingStates);
        setTransitions(remainingTransitions);
        setAcceptingStates(prev => {
            const next = new Set(prev);
            next.delete(stateId);
            return next;
        });

        if (startState === stateId) {
            const nextStart = remainingStates.length > 0 ? remainingStates[0].id : null;
            setStartState(nextStart);
            if (nextStart) {
                refreshStateVisuals(remainingStates, nextStart, acceptingStates);
            }
        }
        resetSimulation();
    };

    // ─── Create Styled JointJS Link ──────────────────────────────────────────
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
                    d: 'M 10 -5 0 0 10 5 Z',
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

    // ─── Confirm Transition ──────────────────────────────────────────────────
    const confirmTransition = () => {
        if (!graph || !transitionSource || !transitionTarget || !transitionLabel) return;
        if (machineType === 'DFA' && transitionLabel === 'ε') {
            alert('Epsilon (ε) transitions are only valid in NFA machines.');
            return;
        }

        const sourceState = states.find(s => s.id === transitionSource);
        const targetState = states.find(s => s.id === transitionTarget);
        if (!sourceState || !targetState) return;

        // Check if a transition with the exact same symbol already exists from this source
        if (machineType === 'DFA') {
            const duplicate = transitions.find(
                t => t.sourceId === sourceState.id && t.label === transitionLabel
            );
            if (duplicate) {
                alert(`DFA cannot have multiple transitions from ${sourceState.label} on symbol "${transitionLabel}".`);
                return;
            }
        }

        const existingLink = graph.getLinks().find(link => {
            const sId = link.getSourceElement()?.id;
            const tId = link.getTargetElement()?.id;
            return sId === sourceState.id && tId === targetState.id;
        });

        if (existingLink) {
            const existingLabel = existingLink.labels()[0]?.attrs?.label?.text || '';
            const labelsArray = existingLabel ? existingLabel.split(', ').map(s => s.trim()) : [];
            if (!labelsArray.includes(transitionLabel)) {
                labelsArray.push(transitionLabel);
            }
            const combined = labelsArray.join(', ');

            existingLink.labels([{
                markup: [
                    { tagName: 'rect', selector: 'body' },
                    { tagName: 'text', selector: 'label' },
                ],
                attrs: {
                    label: {
                        text: combined,
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

        setShowTransitionModal(false);
        setTransitionSource('');
        setTransitionTarget('');
        setTransitionLabel('');
        resetSimulation();
    };

    // ─── Delete a Single Transition ──────────────────────────────────────────
    const deleteTransition = (index) => {
        const trToDelete = transitions[index];
        if (!trToDelete) return;

        const remaining = transitions.filter((_, idx) => idx !== index);
        setTransitions(remaining);

        const sourceStateId = trToDelete.sourceId;
        const targetStateId = trToDelete.targetId;

        const existingLink = graph.getLinks().find(link => {
            const sId = link.getSourceElement()?.id;
            const tId = link.getTargetElement()?.id;
            return sId === sourceStateId && tId === targetStateId;
        });

        if (existingLink) {
            const otherTransitions = remaining.filter(
                t => t.sourceId === sourceStateId && t.targetId === targetStateId
            );
            if (otherTransitions.length === 0) {
                existingLink.remove();
            } else {
                const newLabel = otherTransitions.map(t => t.label).join(', ');
                existingLink.labels([{
                    markup: [
                        { tagName: 'rect', selector: 'body' },
                        { tagName: 'text', selector: 'label' },
                    ],
                    attrs: {
                        label: {
                            text: newLabel,
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
            }
        }
        resetSimulation();
    };

    // ─── Machine Persistence: Save ───────────────────────────────────────────
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
        link.download = `${machineType.toLowerCase()}_automaton.json`;
        link.click();
    };

    // ─── Machine Persistence: Render from Data ───────────────────────────────
    const renderMachineData = (data) => {
        if (!graph) return;
        graph.clear();
        setStates([]);
        setTransitions([]);
        setStateCounter(0);
        setAcceptingStates(new Set());
        resetSimulation();

        const stateMap = {};
        const newAcceptingStates = new Set();
        const newStates = [];

        setMachineType(data.machineType || 'DFA');

        data.states.forEach(state => {
            const circle = new shapes.standard.Circle({ id: state.id });
            circle.position(state.x, state.y);
            circle.resize(60, 60);

            const isStart = data.startState === circle.id;
            const isAccepting = !!state.isAccepting;
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
            if (isAccepting) newAcceptingStates.add(circle.id);
            newStates.push({ id: circle.id, label: state.label, node: circle });
        });

        setStates(newStates);
        setStateCounter(data.states.length);
        setAcceptingStates(newAcceptingStates);
        setStartState(data.startState);

        // Group transitions between same source and target
        const linkMap = new Map();
        const newTransitions = [];

        data.transitions.forEach(transition => {
            const sourceStateId = stateMap[transition.sourceId];
            const targetStateId = stateMap[transition.targetId];

            if (sourceStateId && targetStateId) {
                const pairKey = `${sourceStateId}->${targetStateId}`;
                if (!linkMap.has(pairKey)) linkMap.set(pairKey, []);
                linkMap.get(pairKey).push(transition.label);

                newTransitions.push({
                    sourceId: sourceStateId,
                    targetId: targetStateId,
                    label: transition.label,
                    source: transition.source,
                    target: transition.target,
                });
            }
        });

        linkMap.forEach((labels, pairKey) => {
            const [sourceStateId, targetStateId] = pairKey.split('->');
            const combinedLabel = labels.join(', ');
            const link = createStyledLink(sourceStateId, targetStateId, combinedLabel);
            link.addTo(graph);
        });

        setTransitions(newTransitions);
    };

    // ─── Machine Persistence: Load from File ─────────────────────────────────
    const loadMachine = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                renderMachineData(data);
            } catch (err) {
                alert('Invalid JSON file: ' + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    // ─── Clear All ───────────────────────────────────────────────────────────
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
        resetSimulation();
    };

    // ─── Simulation Engine ───────────────────────────────────────────────────
    const resetSimulation = useCallback(() => {
        setIsPlaying(false);
        if (playTimerRef.current) clearInterval(playTimerRef.current);
        setCurrentStepIndex(-1);
        setSimulationSteps([]);
        setTestResult(null);

        // Reset visual appearance of nodes & links
        refreshStateVisuals(states, startState, acceptingStates);
        if (graph) {
            graph.getLinks().forEach(link => {
                link.attr('line/stroke', COLORS.linkDefault);
                link.attr('line/strokeWidth', 2);
                link.attr('line/targetMarker/fill', COLORS.linkDefault);
                link.attr('line/targetMarker/stroke', COLORS.linkDefault);
            });
        }
    }, [states, startState, acceptingStates, refreshStateVisuals, graph]);

    // Build the execution steps for simulation
    const buildSimulationSteps = useCallback(() => {
        if (!states.length || !startState) return null;

        const startNode = states.find(s => s.id === startState);
        if (!startNode) return null;

        if (machineType === 'DFA') {
            const transitionMap = new Map();
            transitions.forEach(t => {
                transitionMap.set(`${t.sourceId}-${t.label}`, t.targetId);
            });

            const steps = [{
                stateId: startNode.id,
                stateLabel: startNode.label,
                symbol: null,
                charIndex: -1,
                acceptedSoFar: acceptingStates.has(startNode.id),
                message: `Start at ${startNode.label}`,
            }];

            const stateIdToObj = new Map(states.map(s => [s.id, s]));
            let currentId = startNode.id;
            for (let i = 0; i < testString.length; i++) {
                const sym = testString[i];
                const nextId = transitionMap.get(`${currentId}-${sym}`);
                if (!nextId) {
                    const currLabel = stateIdToObj.get(currentId)?.label || currentId;
                    return {
                        success: false,
                        steps,
                        message: `Rejected: no transition from state "${currLabel}" on symbol '${sym}'`,
                        path: steps.map(s => s.stateLabel),
                    };
                }
                const nextNode = stateIdToObj.get(nextId);
                steps.push({
                    stateId: nextId,
                    stateLabel: nextNode?.label || nextId,
                    symbol: sym,
                    charIndex: i,
                    sourceId: currentId,
                    acceptedSoFar: acceptingStates.has(nextId),
                    message: `Read '${sym}' ➔ State ${nextNode?.label}`,
                });
                currentId = nextId;
            }

            const isAccepted = acceptingStates.has(currentId);
            return {
                success: isAccepted,
                steps,
                message: isAccepted
                    ? `Accepted: string ended in accepting state ${states.find(s => s.id === currentId)?.label}`
                    : `Rejected: ended in non-accepting state ${states.find(s => s.id === currentId)?.label}`,
                path: steps.map(s => s.stateLabel),
            };
        } else {
            // NFA with ε transitions (DFS)
            const transitionMap = new Map();
            const epsilonMap = new Map();

            transitions.forEach(t => {
                if (t.label === 'ε') {
                    if (!epsilonMap.has(t.sourceId)) epsilonMap.set(t.sourceId, []);
                    epsilonMap.get(t.sourceId).push(t.targetId);
                } else {
                    const key = `${t.sourceId}-${t.label}`;
                    if (!transitionMap.has(key)) transitionMap.set(key, []);
                    transitionMap.get(key).push(t.targetId);
                }
            });

            const dfs = (currId, remainingChars, pathSteps, visitedEps = new Set()) => {
                if (remainingChars.length === 0) {
                    if (acceptingStates.has(currId)) {
                        return { accepted: true, steps: pathSteps };
                    }
                }

                // Check epsilon moves
                const epsMoves = epsilonMap.get(currId) || [];
                for (const nextId of epsMoves) {
                    if (!visitedEps.has(nextId)) {
                        const nextNode = states.find(s => s.id === nextId);
                        const res = dfs(
                            nextId,
                            remainingChars,
                            [...pathSteps, {
                                stateId: nextId,
                                stateLabel: nextNode?.label,
                                symbol: 'ε',
                                sourceId: currId,
                                message: `ε-move ➔ State ${nextNode?.label}`,
                            }],
                            new Set([...visitedEps, nextId])
                        );
                        if (res) return res;
                    }
                }

                // Check symbol moves
                if (remainingChars.length > 0) {
                    const sym = remainingChars[0];
                    const rest = remainingChars.slice(1);
                    const moves = transitionMap.get(`${currId}-${sym}`) || [];
                    for (const nextId of moves) {
                        const nextNode = states.find(s => s.id === nextId);
                        const res = dfs(
                            nextId,
                            rest,
                            [...pathSteps, {
                                stateId: nextId,
                                stateLabel: nextNode?.label,
                                symbol: sym,
                                sourceId: currId,
                                message: `Read '${sym}' ➔ State ${nextNode?.label}`,
                            }],
                            new Set()
                        );
                        if (res) return res;
                    }
                }

                return null;
            };

            const initialSteps = [{
                stateId: startNode.id,
                stateLabel: startNode.label,
                symbol: null,
                charIndex: -1,
                message: `Start at ${startNode.label}`,
            }];

            const result = dfs(startNode.id, Array.from(testString), initialSteps);
            if (result && result.accepted) {
                return {
                    success: true,
                    steps: result.steps,
                    message: `Accepted: found valid path to accepting state ${result.steps[result.steps.length - 1].stateLabel}`,
                    path: result.steps.map(s => s.stateLabel),
                };
            } else {
                return {
                    success: false,
                    steps: initialSteps,
                    message: `Rejected: no accepting computation path found for "${testString}"`,
                    path: [],
                };
            }
        }
    }, [states, startState, machineType, transitions, testString, acceptingStates]);

    // Apply visual highlight for current simulation step
    const applyStepVisuals = useCallback((stepIdx, steps) => {
        if (!steps || steps.length === 0 || stepIdx < 0 || stepIdx >= steps.length) return;

        const currentStep = steps[stepIdx];

        // 1. Color states: normal vs current
        states.forEach(s => {
            if (s.id === currentStep.stateId) {
                s.node.attr('body/fill', COLORS.activeCurrent);
                s.node.attr('body/stroke', COLORS.activeCurrentStroke);
                s.node.attr('body/strokeWidth', 4);
            } else {
                const c = getStateColor(s.id, startState, acceptingStates);
                s.node.attr('body/fill', c.fill);
                s.node.attr('body/stroke', c.stroke);
                s.node.attr('body/strokeWidth', acceptingStates.has(s.id) ? 4 : 2.5);
            }
        });

        // 2. Highlight transition links
        if (graph) {
            graph.getLinks().forEach(link => {
                const sId = link.getSourceElement()?.id;
                const tId = link.getTargetElement()?.id;
                if (currentStep.sourceId && sId === currentStep.sourceId && tId === currentStep.stateId) {
                    link.attr('line/stroke', COLORS.linkHighlight);
                    link.attr('line/strokeWidth', 3.5);
                    link.attr('line/targetMarker/fill', COLORS.linkHighlight);
                    link.attr('line/targetMarker/stroke', COLORS.linkHighlight);
                } else {
                    link.attr('line/stroke', COLORS.linkDefault);
                    link.attr('line/strokeWidth', 2);
                    link.attr('line/targetMarker/fill', COLORS.linkDefault);
                    link.attr('line/targetMarker/stroke', COLORS.linkDefault);
                }
            });
        }
    }, [states, startState, acceptingStates, getStateColor, graph]);

    // ─── Test String Run (Instant) ───────────────────────────────────────────
    const runInstantTest = () => {
        resetSimulation();
        const outcome = buildSimulationSteps();
        if (!outcome) {
            setTestResult({ accepted: false, message: 'Please define states and a start state first.' });
            return;
        }

        setSimulationSteps(outcome.steps);
        setTestResult({
            accepted: outcome.success,
            message: outcome.message,
            path: outcome.path,
        });

        // Highlight the final state reached
        if (outcome.steps.length > 0) {
            const finalIdx = outcome.steps.length - 1;
            setCurrentStepIndex(finalIdx);
            applyStepVisuals(finalIdx, outcome.steps);
        }
    };

    // ─── Stepping Controls ───────────────────────────────────────────────────
    const handleStepForward = () => {
        let steps = simulationSteps;
        if (steps.length === 0) {
            const outcome = buildSimulationSteps();
            if (!outcome) return;
            steps = outcome.steps;
            setSimulationSteps(steps);
            setTestResult({
                accepted: outcome.success,
                message: outcome.message,
                path: outcome.path,
            });
        }

        if (currentStepIndex + 1 < steps.length) {
            const nextIdx = currentStepIndex + 1;
            setCurrentStepIndex(nextIdx);
            applyStepVisuals(nextIdx, steps);
        }
    };

    const handleStepBackward = () => {
        if (currentStepIndex > 0) {
            const prevIdx = currentStepIndex - 1;
            setCurrentStepIndex(prevIdx);
            applyStepVisuals(prevIdx, simulationSteps);
        }
    };

    // Auto Play / Pause
    const toggleAutoPlay = () => {
        if (isPlaying) {
            setIsPlaying(false);
            if (playTimerRef.current) clearInterval(playTimerRef.current);
        } else {
            let steps = simulationSteps;
            if (steps.length === 0) {
                const outcome = buildSimulationSteps();
                if (!outcome) return;
                steps = outcome.steps;
                setSimulationSteps(steps);
                setTestResult({
                    accepted: outcome.success,
                    message: outcome.message,
                    path: outcome.path,
                });
            }

            setIsPlaying(true);
            let idx = currentStepIndex;
            if (idx >= steps.length - 1) idx = -1;

            playTimerRef.current = setInterval(() => {
                idx++;
                if (idx < steps.length) {
                    setCurrentStepIndex(idx);
                    applyStepVisuals(idx, steps);
                } else {
                    setIsPlaying(false);
                    clearInterval(playTimerRef.current);
                }
            }, 650);
        }
    };

    // ─── Canvas Zooming ──────────────────────────────────────────────────────
    const handleZoomIn = () => {
        if (!paperInstance.current) return;
        const nextZoom = Math.min(zoomLevel + 0.15, 2.2);
        paperInstance.current.scale(nextZoom, nextZoom);
        setZoomLevel(nextZoom);
    };

    const handleZoomOut = () => {
        if (!paperInstance.current) return;
        const nextZoom = Math.max(zoomLevel - 0.15, 0.45);
        paperInstance.current.scale(nextZoom, nextZoom);
        setZoomLevel(nextZoom);
    };

    const handleResetZoom = () => {
        if (!paperInstance.current) return;
        paperInstance.current.scale(1, 1);
        paperInstance.current.translate(0, 0);
        setZoomLevel(1);
    };

    // ─── NFA to DFA Conversion ───────────────────────────────────────────────
    const convertNfaToDfa = () => {
        if (machineType !== 'NFA' || !startState) {
            alert('Please select NFA mode and define a start state.');
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

        const data = {
            machineType: 'DFA',
            startState: startDfaState.id,
            states: dfaStates.map((s, idx) => ({
                id: s.id,
                label: s.label,
                x: 100 + (idx % 5) * 150,
                y: 80 + Math.floor(idx / 5) * 150,
                isAccepting: s.isAccepting,
            })),
            transitions: dfaTransitions,
        };

        renderMachineData(data);
    };

    // ─── DFA Minimization (Hopcroft Partition Refinement) ─────────────────────
    const minimizeDfa = () => {
        if (machineType !== 'DFA' || !startState) {
            alert('Minimization requires a DFA with a designated start state.');
            return;
        }

        const alphabet = new Set();
        transitions.forEach(t => alphabet.add(t.label));
        const transMap = new Map();
        transitions.forEach(t => {
            transMap.set(`${t.sourceId}-${t.label}`, t.targetId);
        });

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

        const minStates = [];
        const minTransitions = [];
        const partitionMap = new Map();

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

    // ─── DFA Equivalence Checking ────────────────────────────────────────────
    const handleDfaFileUpload = (fileNumber, event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    if (fileNumber === 1) setDfa1(parsed);
                    else setDfa2(parsed);
                } catch (err) {
                    alert('Error parsing JSON: ' + err.message);
                }
            };
            reader.readAsText(file);
            event.target.value = '';
        }
    };

    const checkDfaEquivalence = () => {
        if (!dfa1 || !dfa2) {
            alert('Please select both DFA JSON files.');
            return;
        }

        if (dfa1.machineType !== 'DFA' || dfa2.machineType !== 'DFA') {
            setEquivalenceResult({ equivalent: false, message: 'Both machines must be DFAs.' });
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

        const alphabet = new Set();
        dfa1.transitions.forEach(t => alphabet.add(t.label));
        dfa2.transitions.forEach(t => alphabet.add(t.label));

        const start1 = stateMap1.get(dfa1.startState);
        const start2 = stateMap2.get(dfa2.startState);

        if (!start1 || !start2) {
            setEquivalenceResult({ equivalent: false, message: 'Missing valid start states in DFA inputs.' });
            return;
        }

        // BFS product construction
        const queue = [{ s1: start1, s2: start2, path: '' }];
        const visited = new Set([`${start1.id},${start2.id}`]);

        while (queue.length > 0) {
            const { s1, s2, path } = queue.shift();

            // Disagreeing acceptance
            const acc1 = !!s1.isAccepting;
            const acc2 = !!s2.isAccepting;
            if (acc1 !== acc2) {
                setEquivalenceResult({
                    equivalent: false,
                    message: `Not equivalent. Distinguishing string: "${path || 'ε'}" — produces (${s1.label}, ${s2.label}).`,
                });
                return;
            }

            for (const sym of alphabet) {
                const nextId1 = transMap1.get(`${s1.id}-${sym}`);
                const nextId2 = transMap2.get(`${s2.id}-${sym}`);

                if (nextId1 && nextId2) {
                    const key = `${nextId1},${nextId2}`;
                    if (!visited.has(key)) {
                        visited.add(key);
                        queue.push({
                            s1: stateMap1.get(nextId1),
                            s2: stateMap2.get(nextId2),
                            path: path + sym,
                        });
                    }
                }
            }
        }

        setEquivalenceResult({
            equivalent: true,
            message: 'Analysis complete: The two DFAs are language-equivalent ✓',
        });
    };

    // ─── Example Presets ─────────────────────────────────────────────────────
    const loadExample = (type) => {
        let data;
        if (type === 'DFA_ENDS_WITH_1') {
            data = {
                machineType: 'DFA',
                startState: 'q0',
                states: [
                    { id: 'q0', label: 'q0', x: 140, y: 180, isAccepting: false },
                    { id: 'q1', label: 'q1', x: 380, y: 180, isAccepting: true },
                ],
                transitions: [
                    { sourceId: 'q0', targetId: 'q0', label: '0', source: 'q0', target: 'q0' },
                    { sourceId: 'q0', targetId: 'q1', label: '1', source: 'q0', target: 'q1' },
                    { sourceId: 'q1', targetId: 'q0', label: '0', source: 'q1', target: 'q0' },
                    { sourceId: 'q1', targetId: 'q1', label: '1', source: 'q1', target: 'q1' },
                ],
            };
        } else if (type === 'NFA_CONTAINS_101') {
            data = {
                machineType: 'NFA',
                startState: 'q0',
                states: [
                    { id: 'q0', label: 'q0', x: 80, y: 180, isAccepting: false },
                    { id: 'q1', label: 'q1', x: 260, y: 180, isAccepting: false },
                    { id: 'q2', label: 'q2', x: 440, y: 180, isAccepting: false },
                    { id: 'q3', label: 'q3', x: 620, y: 180, isAccepting: true },
                ],
                transitions: [
                    { sourceId: 'q0', targetId: 'q0', label: '0', source: 'q0', target: 'q0' },
                    { sourceId: 'q0', targetId: 'q0', label: '1', source: 'q0', target: 'q0' },
                    { sourceId: 'q0', targetId: 'q1', label: '1', source: 'q0', target: 'q1' },
                    { sourceId: 'q1', targetId: 'q2', label: '0', source: 'q1', target: 'q2' },
                    { sourceId: 'q2', targetId: 'q3', label: '1', source: 'q2', target: 'q3' },
                    { sourceId: 'q3', targetId: 'q3', label: '0', source: 'q3', target: 'q3' },
                    { sourceId: 'q3', targetId: 'q3', label: '1', source: 'q3', target: 'q3' },
                ],
            };
        } else if (type === 'NFA_EPSILON') {
            data = {
                machineType: 'NFA',
                startState: 'q0',
                states: [
                    { id: 'q0', label: 'q0', x: 100, y: 180, isAccepting: false },
                    { id: 'q1', label: 'q1', x: 280, y: 100, isAccepting: false },
                    { id: 'q2', label: 'q2', x: 280, y: 260, isAccepting: false },
                    { id: 'q3', label: 'q3', x: 480, y: 180, isAccepting: true },
                ],
                transitions: [
                    { sourceId: 'q0', targetId: 'q1', label: 'ε', source: 'q0', target: 'q1' },
                    { sourceId: 'q0', targetId: 'q2', label: 'ε', source: 'q0', target: 'q2' },
                    { sourceId: 'q1', targetId: 'q3', label: 'a', source: 'q1', target: 'q3' },
                    { sourceId: 'q2', targetId: 'q3', label: 'b', source: 'q2', target: 'q3' },
                ],
            };
        }
        if (data) renderMachineData(data);
    };

    // ─── Transition Table Matrix ─────────────────────────────────────────────
    const uniqueAlphabet = Array.from(new Set(transitions.map(t => t.label))).sort();

    // ═══════════════════════════════════════════════════════════════════════════
    // ─── RENDER ────────────────═══════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════════════

    return (
        <div className="main-content">
            {/* ─── Control Sidebar ────────────────────────────────────────── */}
            <aside className="sidebar">
                {/* Mode Selector */}
                <div className="sidebar-section">
                    <div className="machine-type-selector">
                        <button
                            className={`type-btn ${machineType === 'DFA' ? 'active' : ''}`}
                            onClick={() => {
                                setMachineType('DFA');
                                resetSimulation();
                            }}
                        >
                            DFA (Deterministic)
                        </button>
                        <button
                            className={`type-btn ${machineType === 'NFA' ? 'active' : ''}`}
                            onClick={() => {
                                setMachineType('NFA');
                                resetSimulation();
                            }}
                        >
                            NFA (Nondeterministic)
                        </button>
                    </div>

                    {/* Navigation Tabs */}
                    <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', padding: '3px', borderRadius: 'var(--radius-sm)' }}>
                        <button
                            className="action-btn"
                            style={{
                                flex: 1,
                                background: activeTab === 'build' ? 'var(--bg-card)' : 'transparent',
                                color: activeTab === 'build' ? 'var(--text-primary)' : 'var(--text-muted)',
                                border: 'none',
                                padding: '6px',
                                fontSize: '0.74rem',
                            }}
                            onClick={() => setActiveTab('build')}
                        >
                            <FaProjectDiagram /> Studio
                        </button>
                        <button
                            className="action-btn"
                            style={{
                                flex: 1,
                                background: activeTab === 'table' ? 'var(--bg-card)' : 'transparent',
                                color: activeTab === 'table' ? 'var(--text-primary)' : 'var(--text-muted)',
                                border: 'none',
                                padding: '6px',
                                fontSize: '0.74rem',
                            }}
                            onClick={() => setActiveTab('table')}
                        >
                            <FaTable /> Table (δ)
                        </button>
                        <button
                            className="action-btn"
                            style={{
                                flex: 1,
                                background: activeTab === 'equivalence' ? 'var(--bg-card)' : 'transparent',
                                color: activeTab === 'equivalence' ? 'var(--text-primary)' : 'var(--text-muted)',
                                border: 'none',
                                padding: '6px',
                                fontSize: '0.74rem',
                            }}
                            onClick={() => setActiveTab('equivalence')}
                        >
                            <FaExchangeAlt /> Compare
                        </button>
                    </div>
                </div>

                {/* ── Tab 1: Studio (Build & Edit) ─────────────────────────── */}
                {activeTab === 'build' && (
                    <>
                        {/* Core Actions */}
                        <div className="sidebar-section">
                            <div className="section-header">
                                <div className="section-icon blue">◆</div>
                                <span className="section-title">Automata Tools</span>
                            </div>
                            <div className="action-grid">
                                <button className="action-btn primary" onClick={addState}>
                                    <FaPlus /> Add State
                                </button>
                                <button
                                    className="action-btn primary"
                                    onClick={() => setShowTransitionModal(true)}
                                    disabled={states.length < 1}
                                >
                                    ⟶ Add Transition
                                </button>
                                <button className="action-btn" onClick={saveMachine} disabled={states.length === 0}>
                                    <FaFileDownload /> Export JSON
                                </button>
                                <button className="action-btn" onClick={() => document.getElementById('fileInput').click()}>
                                    <FaFileUpload /> Import JSON
                                </button>
                                <input type="file" onChange={loadMachine} accept=".json" style={{ display: 'none' }} id="fileInput" />

                                {machineType === 'NFA' && (
                                    <button className="action-btn success full-width" onClick={convertNfaToDfa} disabled={states.length === 0}>
                                        ⟹ Convert NFA → DFA
                                    </button>
                                )}
                                {machineType === 'DFA' && (
                                    <button className="action-btn warning full-width" onClick={minimizeDfa} disabled={states.length === 0}>
                                        ⊡ Minimize DFA (Hopcroft)
                                    </button>
                                )}
                                <button className="action-btn danger full-width" onClick={clearMachine}>
                                    <FaTrash /> Clear Machine
                                </button>
                            </div>
                        </div>

                        {/* Presets */}
                        <div className="sidebar-section">
                            <div className="section-header">
                                <div className="section-icon green">★</div>
                                <span className="section-title">Presets & Examples</span>
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
                                    <span className="section-title">Designate Start State</span>
                                </div>
                                <select
                                    className="select-field"
                                    value={startState || ''}
                                    onChange={(e) => setStartingState(e.target.value)}
                                >
                                    <option value="">Choose start state…</option>
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
                                                    title={acceptingStates.has(state.id) ? 'Unmark accepting state' : 'Mark as accepting state'}
                                                    style={{ color: acceptingStates.has(state.id) ? 'var(--success)' : 'var(--text-muted)' }}
                                                >
                                                    {acceptingStates.has(state.id) ? <FaCheck /> : '○'}
                                                </button>
                                                <button
                                                    className="state-action-btn"
                                                    onClick={() => deleteState(state.id)}
                                                    title="Delete state"
                                                    style={{ color: 'var(--danger)' }}
                                                >
                                                    <FaTrash />
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
                                            <span className="transition-arrow">──</span>
                                            <span className="transition-label-badge">{t.label}</span>
                                            <span className="transition-arrow">─➔</span>
                                            <span>{t.target}</span>
                                            <button
                                                className="state-action-btn"
                                                onClick={() => deleteTransition(index)}
                                                title="Delete transition"
                                                style={{ marginLeft: 'auto', color: 'var(--danger)' }}
                                            >
                                                <FaTimes />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ── Tab 2: Transition Table (δ) ─────────────────────────── */}
                {activeTab === 'table' && (
                    <div className="sidebar-section">
                        <div className="section-header">
                            <div className="section-icon purple"><FaTable /></div>
                            <span className="section-title">Transition Function Matrix</span>
                        </div>
                        {states.length === 0 ? (
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                Add states and transitions to view the transition matrix.
                            </p>
                        ) : (
                            <div style={{ overflowX: 'auto', marginTop: '8px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontFamily: "'JetBrains Mono', monospace" }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-default)' }}>
                                            <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-secondary)' }}>State</th>
                                            {uniqueAlphabet.map(sym => (
                                                <th key={sym} style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--accent-secondary)' }}>
                                                    {sym}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {states.map(s => (
                                            <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                                <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>
                                                    {s.id === startState ? '➔ ' : ''}{acceptingStates.has(s.id) ? '*' : ''}{s.label}
                                                </td>
                                                {uniqueAlphabet.map(sym => {
                                                    const matching = transitions
                                                        .filter(t => t.sourceId === s.id && t.label === sym)
                                                        .map(t => t.target);
                                                    return (
                                                        <td key={sym} style={{ padding: '6px 8px', textAlign: 'center', color: matching.length > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                                            {matching.length > 0 ? (machineType === 'NFA' ? `{${matching.join(',')}}` : matching.join(', ')) : '—'}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                                    * denotes accepting state, ➔ denotes start state.
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Tab 3: Equivalence Checker ───────────────────────────── */}
                {activeTab === 'equivalence' && (
                    <div className="sidebar-section">
                        <div className="section-header">
                            <div className="section-icon red"><FaExchangeAlt /></div>
                            <span className="section-title">DFA Equivalence Verifier</span>
                        </div>
                        <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                            Upload two DFA machine configurations (.json) to check whether they accept the exact same language.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                            <label className="file-upload-label">
                                Machine A: {dfa1 ? `Loaded (${dfa1.states?.length || 0} states)` : 'Select JSON'}
                                <input
                                    type="file"
                                    onChange={(e) => handleDfaFileUpload(1, e)}
                                    accept=".json"
                                    style={{ display: 'none' }}
                                />
                                <div className="file-upload-area">
                                    {dfa1 ? `✓ ${dfa1.machineType || 'DFA'} (Ready)` : 'Click to select DFA 1'}
                                </div>
                            </label>
                            <label className="file-upload-label">
                                Machine B: {dfa2 ? `Loaded (${dfa2.states?.length || 0} states)` : 'Select JSON'}
                                <input
                                    type="file"
                                    onChange={(e) => handleDfaFileUpload(2, e)}
                                    accept=".json"
                                    style={{ display: 'none' }}
                                />
                                <div className="file-upload-area">
                                    {dfa2 ? `✓ ${dfa2.machineType || 'DFA'} (Ready)` : 'Click to select DFA 2'}
                                </div>
                            </label>
                        </div>
                        <button
                            className="action-btn primary full-width"
                            onClick={checkDfaEquivalence}
                            disabled={!dfa1 || !dfa2}
                        >
                            Compare DFAs
                        </button>
                        {equivalenceResult && (
                            <div
                                className={`result-toast ${equivalenceResult.equivalent ? 'accepted' : 'rejected'}`}
                                style={{ position: 'relative', marginTop: '12px', right: 'auto', top: 'auto' }}
                            >
                                <span className="result-icon">{equivalenceResult.equivalent ? '✓' : '✗'}</span>
                                <div>{equivalenceResult.message}</div>
                            </div>
                        )}
                    </div>
                )}
            </aside>

            {/* ─── Canvas Workspace ───────────────────────────────────────── */}
            <div className="canvas-area">
                {/* Top Canvas Toolbar */}
                <div className="canvas-toolbar">
                    <span className="toolbar-badge">
                        {machineType} Studio · {states.length} states · {transitions.length} transitions
                    </span>
                    <div className="toolbar-divider" />

                    {/* Canvas Zoom Controls */}
                    <button className="action-btn" onClick={handleZoomIn} title="Zoom in">
                        <FaSearchPlus />
                    </button>
                    <button className="action-btn" onClick={handleZoomOut} title="Zoom out">
                        <FaSearchMinus />
                    </button>
                    <button className="action-btn" onClick={handleResetZoom} title="Reset zoom">
                        <FaArrowsAlt /> {Math.round(zoomLevel * 100)}%
                    </button>

                    <div style={{ flex: 1 }} />

                    {startState && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Start: <strong style={{ color: 'var(--accent-secondary)' }}>{states.find(s => s.id === startState)?.label}</strong>
                        </span>
                    )}
                </div>

                {/* JointJS Graph Paper */}
                <div className="canvas-wrapper">
                    <div ref={paperRef} style={{ width: '100%', height: '100%', minHeight: '600px' }} />

                    {states.length === 0 && (
                        <div className="empty-state">
                            <div className="empty-state-icon">◎</div>
                            <div className="empty-state-text">Automaton canvas is empty</div>
                            <div className="empty-state-hint">
                                Click "+ Add State" or choose a Preset to begin modeling your finite state machine.
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── Bottom Floating Simulation & Testing Bar ─────────────── */}
                {states.length > 0 && startState && (
                    <div className="test-panel" style={{ flexDirection: 'column', gap: '8px', minWidth: '580px' }}>
                        {/* Upper row: Input and Quick Chips */}
                        <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                Input String:
                            </span>
                            <input
                                className="test-input"
                                type="text"
                                value={testString}
                                onChange={(e) => {
                                    setTestString(e.target.value);
                                    resetSimulation();
                                }}
                                placeholder="Enter input (e.g. 1010)…"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') runInstantTest();
                                }}
                            />

                            {/* Quick Append Chips */}
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button className="action-btn" style={{ padding: '4px 8px' }} onClick={() => setTestString(prev => prev + '0')}>0</button>
                                <button className="action-btn" style={{ padding: '4px 8px' }} onClick={() => setTestString(prev => prev + '1')}>1</button>
                                {machineType === 'NFA' && (
                                    <button className="action-btn" style={{ padding: '4px 8px', color: 'var(--accent-secondary)' }} onClick={() => setTestString(prev => prev + 'ε')}>ε</button>
                                )}
                                <button className="action-btn" style={{ padding: '4px 8px' }} onClick={() => { setTestString(''); resetSimulation(); }}>Clear</button>
                            </div>

                            <button className="test-btn" onClick={runInstantTest}>
                                Test (Instant)
                            </button>
                        </div>

                        {/* Lower row: Interactive Step-by-Step Simulation Controls */}
                        <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                    className="action-btn"
                                    onClick={resetSimulation}
                                    title="Reset simulation to beginning"
                                >
                                    <FaRedo /> Reset
                                </button>
                                <button
                                    className="action-btn"
                                    onClick={handleStepBackward}
                                    disabled={currentStepIndex <= 0}
                                    title="Step backward"
                                >
                                    <FaStepBackward /> Step Back
                                </button>
                                <button
                                    className="action-btn primary"
                                    onClick={handleStepForward}
                                    disabled={simulationSteps.length > 0 && currentStepIndex >= simulationSteps.length - 1}
                                    title="Step forward"
                                >
                                    <FaStepForward /> Step Forward
                                </button>
                                <button
                                    className="action-btn"
                                    onClick={toggleAutoPlay}
                                    title={isPlaying ? 'Pause simulation' : 'Auto-play simulation'}
                                >
                                    {isPlaying ? <FaPause /> : <FaPlay />} {isPlaying ? 'Pause' : 'Play'}
                                </button>
                            </div>

                            {/* Simulation Step Status */}
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
                                {currentStepIndex >= 0 && simulationSteps[currentStepIndex] ? (
                                    <span>
                                        Step {currentStepIndex + 1}/{simulationSteps.length}: <strong>{simulationSteps[currentStepIndex].message}</strong>
                                    </span>
                                ) : (
                                    <span>Ready to simulate</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Result Notification Toast ────────────────────────────── */}
                {testResult && (
                    <div className={`result-toast ${testResult.accepted ? 'accepted' : 'rejected'}`}>
                        <span className="result-icon">{testResult.accepted ? '✓' : '✗'}</span>
                        <div>
                            <div style={{ fontWeight: 600 }}>{testResult.message}</div>
                            {testResult.path && testResult.path.length > 0 && (
                                <div className="result-path">
                                    Path: {testResult.path.join(' ➔ ')}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Transition Modal ─────────────────────────────────────────── */}
            {showTransitionModal && (
                <div className="modal-overlay" onClick={() => setShowTransitionModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">Define Transition (δ)</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                                    Source State (Current)
                                </label>
                                <select
                                    className="select-field"
                                    value={transitionSource}
                                    onChange={(e) => setTransitionSource(e.target.value)}
                                >
                                    <option value="">Select source state…</option>
                                    {states.map(state => (
                                        <option key={state.id} value={state.id}>{state.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                                    Target State (Next)
                                </label>
                                <select
                                    className="select-field"
                                    value={transitionTarget}
                                    onChange={(e) => setTransitionTarget(e.target.value)}
                                >
                                    <option value="">Select target state…</option>
                                    {states.map(state => (
                                        <option key={state.id} value={state.id}>{state.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                        Input Symbol
                                    </label>
                                    {machineType === 'NFA' && (
                                        <button
                                            type="button"
                                            className="epsilon-btn"
                                            onClick={() => setTransitionLabel('ε')}
                                            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                                        >
                                            Insert ε
                                        </button>
                                    )}
                                </div>
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
                            <button className="action-btn" onClick={() => setShowTransitionModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="action-btn primary"
                                onClick={confirmTransition}
                                disabled={!transitionSource || !transitionTarget || !transitionLabel}
                            >
                                Confirm Transition
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DfaNfaVisualizer;
