import React, { useState, useEffect, useRef } from 'react';
import { dia, shapes } from 'jointjs';

const DfaNfaVisualizer = () => {
    const paperRef = useRef(null);
    const [graph, setGraph] = useState(null);
    const [stateCounter, setStateCounter] = useState(0);
    const [states, setStates] = useState([]);
    const [transitions, setTransitions] = useState([]);
    const [isAddingTransition, setIsAddingTransition] = useState(false);
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

    useEffect(() => {
        const newGraph = new dia.Graph({}, { cellNamespace: shapes });
        const paper = new dia.Paper({
            el: paperRef.current,
            width: 900,
            height: 650,
            model: newGraph,
            cellViewNamespace: shapes,
            gridSize: 10,
            drawGrid: true,
            interactive: true,
            defaultLink: new shapes.standard.Link(),
            defaultConnectionPoint: { name: 'boundary' },
            validateConnection: () => true,
            background: {
                color: 'transparent'
            }
        });

        // Enable dragging for all elements
        paper.on('element:pointerdown', function(elementView) {
            const element = elementView.model;
            element.toFront();
        });

        setGraph(newGraph);
    }, []);


    const setStartingState = (stateId) => {
        // Update visual appearance of previous start state
        if (startState) {
            const prevStartState = states.find(s => s.id === startState);
            prevStartState?.node.attr('body/fill', acceptingStates.has(prevStartState.id) ? '#90EE90' : '#ccccff');
        }

        // Update visual appearance of new start state
        const newStartState = states.find(s => s.id === stateId);
        newStartState?.node.attr('body/fill', '#FFE4E1');

        setStartState(stateId);
    };

    const toggleAcceptingState = (stateId) => {
        setAcceptingStates(prev => {
            const newSet = new Set(prev);
            if (newSet.has(stateId)) {
                newSet.delete(stateId);
                // Update visual appearance to non-accepting state
                const state = states.find(s => s.id === stateId);
                if (state) {
                    state.node.attr('body/fill', '#ccccff');
                }
            } else {
                newSet.add(stateId);
                // Update visual appearance to accepting state
                const state = states.find(s => s.id === stateId);
                if (state) {
                    state.node.attr('body/fill', '#90EE90');
                }
            }
            return newSet;
        });
    };

    const addState = () => {
        if (!graph) return;

        const label = `q${stateCounter}`;
        // Calculate position to spread circles evenly in a grid with 5 per row
        const circlesPerRow = 5;
        const horizontalSpacing = 140;
        const verticalSpacing = 140;
        const startX = 120;  // Increased to center the circles
        const startY = 100;

        const x = startX + (stateCounter % circlesPerRow) * horizontalSpacing;
        const y = startY + Math.floor(stateCounter / circlesPerRow) * verticalSpacing;

        const circle = new shapes.standard.Circle();
        circle.position(x, y);
        circle.resize(60, 60);
        circle.attr({
            body: {
                fill: '#ccccff',
                strokeWidth: 3
            },
            label: {
                text: label,
                fill: 'black',
                fontWeight: 'bold',
                fontSize: 16,
                textAnchor: 'middle',
                textVerticalAnchor: 'middle',
                refX: '50%',
                refY: '50%'
            }
        });
        circle.addTo(graph);

        setStates([...states, { id: circle.id, label, node: circle }]);
        setStateCounter(stateCounter + 1);
    };

    const startAddingTransition = () => {
        setIsAddingTransition(true);
        setTransitionSource(null);
        setTransitionTarget(null);
        setTransitionLabel('');
    };

    const confirmTransition = () => {
        if (!graph || !transitionSource || !transitionTarget || !transitionLabel) return;
        if(machineType === "DFA" && transitionLabel === "ε") return;
        const sourceState = states.find(state => state.id === transitionSource);
        const targetState = states.find(state => state.id === transitionTarget);

        const existingLink = graph.getLinks().find(link => {
            const sourceId = link.getSourceElement().id;
            const targetId = link.getTargetElement().id;
            return sourceId === sourceState.id && targetId === targetState.id;
        });

        if (existingLink) {
            const existingLabel = existingLink.labels()[0].attrs.text.text;
            existingLink.labels([{
                attrs: { text: { text: `${existingLabel}, ${transitionLabel}`, fontSize: 14, fontWeight: 'bold' } },
                position: 0.5,
            }]);
        } else {
            const link = new shapes.standard.Link();
            link.source({ id: sourceState.id });
            link.target({ id: targetState.id });

            if (transitionSource === transitionTarget) {
                link.router({
                    name: 'manhattan',
                    args: {
                        padding: 20,
                        startDirections: ['top'],
                        endDirections: ['bottom'],
                    },
                });
                link.connector('rounded');
            } else {
                link.router({
                    name: 'manhattan',
                    args: {
                        padding: 20,
                        startDirections: ['top', 'left', 'bottom', 'right'],
                        endDirections: ['top', 'left', 'bottom', 'right'],
                    },
                });
            }

            link.attr({
                line: {
                    stroke: 'var(--accent-color)',
                    strokeWidth: 2.5,
                    targetMarker: {
                        type: 'path',
                        d: 'M 12 -6 0 0 12 6 Z',
                        fill: 'var(--accent-color)',
                        stroke: 'var(--accent-color)'
                    },
                    strokeDasharray: '0',
                    targetMarkerSize: 12,
                },
            });
            link.labels([{
                markup: [
                    {
                        tagName: 'rect',
                        selector: 'body'
                    },
                    {
                        tagName: 'text',
                        selector: 'label'
                    }
                ],
                attrs: {
                    label: {
                        text: transitionLabel,
                        fontSize: 15,
                        fontWeight: 'bold',
                        fontFamily: 'var(--font-family)',
                        fill: '#000000',
                        textAnchor: 'middle',
                        textVerticalAnchor: 'middle'
                    },
                    body: {
                        fill: '#FFFFFF',
                        stroke: 'var(--accent-color)',
                        strokeWidth: 2,
                        width: 20,
                        height: 22,
                        x: -10,  // Half of width to center
                        y: -11   // Half of height to center
                    }
                },
                position: 0.5,
            }]);
            link.addTo(graph);
        }

        setTransitions([...transitions, {
            sourceId: sourceState.id,
            source: sourceState.label,
            targetId: targetState.id,
            target: targetState.label,
            label: transitionLabel
        }]);
        setIsAddingTransition(false);
    };

    const saveMachine = () => {
        const machineData = {
            machineType,
            startState,
            states: states.map(state => ({
                label: state.label,
                id: state.id,
                x: state.node.position().x,
                y: state.node.position().y,
                isAccepting: acceptingStates.has(state.id)
            })),
            transitions: transitions.map(transition => ({
                sourceId: transition.sourceId,
                targetId: transition.targetId,
                label: transition.label,
                source: transition.source,
                target: transition.target
            }))
        };

        const blob = new Blob([JSON.stringify(machineData, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'dfa_nfa_machine.json';
        link.click();
    };

    const renderMachineData = (data) => {
        graph.clear();
        setStates([]);
        setTransitions([]);
        setStateCounter(0);
        setAcceptingStates(new Set());

        const stateMap = {};
        const newAcceptingStates = new Set();

        setStartingState(data.startState);
        setMachineType(data.machineType);
        data.states.forEach(state => {
            const circle = new shapes.standard.Circle({
                id: state.id
            });
            circle.position(state.x, state.y);
            circle.resize(60, 60);
            circle.attr({
                body: {
                    fill: state.isAccepting ? '#90EE90' : data.startState === circle.id ? '#FFE4E1':'#ccccff',
                    strokeWidth: 3
                },
                label: { text: state.label, fill: 'black', fontWeight: 'bold' },
            });
            circle.addTo(graph);

            stateMap[state.id] = circle.id;
            if (state.isAccepting) {
                newAcceptingStates.add(circle.id);
            }

            setStates(prevStates => [
                ...prevStates,
                { id: circle.id, label: state.label, node: circle }
            ]);
            setStateCounter(prevCounter => prevCounter + 1);
        });

        setAcceptingStates(newAcceptingStates);

        data.transitions.forEach(transition => {
            const sourceStateId = stateMap[transition.sourceId];
            const targetStateId = stateMap[transition.targetId];

            if (sourceStateId && targetStateId) {
                const existingLink = graph.getLinks().find(link => {
                    const sourceId = link.getSourceElement().id;
                    const targetId = link.getTargetElement().id;
                    return sourceId === sourceStateId && targetId === targetStateId;
                });

                if (existingLink) {
                    const existingLabel = existingLink.labels()[0].attrs.text.text;
                    existingLink.labels([{
                        attrs: { text: { text: `${existingLabel}, ${transition.label}`, fontSize: 14, fontWeight: 'bold' } },
                        position: 0.5,
                    }]);
                } else {
                    const link = new shapes.standard.Link();
                    link.source({ id: sourceStateId });
                    link.target({ id: targetStateId });

                    if (sourceStateId === targetStateId) {
                        link.router({
                            name: 'manhattan',
                            args: {
                                padding: 20,
                                startDirections: ['top'],
                                endDirections: ['bottom'],
                            },
                        });
                        link.connector('rounded');
                    } else {
                        link.router({
                            name: 'manhattan',
                            args: {
                                padding: 20,
                                startDirections: ['top', 'left', 'bottom', 'right'],
                                endDirections: ['top', 'left', 'bottom', 'right'],
                            },
                        });
                    }

                    link.attr({
                        line: {
                            stroke: 'black',
                            strokeWidth: 2,
                            targetMarker: { type: 'path', d: 'M 10 -5 0 0 10 5 Z', fill: 'black' },
                        },
                    });

                    link.labels([{
                        attrs: { text: { text: transition.label, fontSize: 14, fontWeight: 'bold' } },
                        position: 0.5,
                    }]);

                    link.addTo(graph);
                }

                setTransitions(prevTransitions => [
                    ...prevTransitions,
                    {
                        sourceId: transition.sourceId,
                        targetId: transition.targetId,
                        label: transition.label,
                        source: transition.source,
                        target: transition.target
                    }
                ]);
            }
        });
    };

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
    // Function to test a given string input
    const testInput = () => {
        // Ensure states and transitions are properly defined
        if (!states || !transitions) {
            setTestResult({
                accepted: false,
                message: 'Error: States, transitions, or input string not properly defined',
                path: []
            });
            return;
        }

        // Optimized transition lookup: Map source and label to target
        const transitionMap = new Map();
        transitions.forEach(t => {
            const key = `${t.source}-${t.label}`;
            transitionMap.set(key, t.target);
        });

        // Start at the designated start state
        let currentState = states.find(s => s.id === startState)?.label;

        if(!currentState || !states.find(t => t.label === currentState)) {
            setTestResult({
                accepted: false,
                message: 'Error: States, transitions, or input string not properly defined',
                path: []
            });
            return;
        }

        //initialize array which holds path
        const path = [currentState];

        // Process each character in the input string
        for (const symbol of testString) {
            const key = `${currentState}-${symbol}`;
            const targetState = transitionMap.get(key);

            // If no transition is found, reject the string
            if (!targetState) {
                setTestResult({
                    accepted: false,
                    message: `Rejected: No transition found from state ${currentState} with symbol ${symbol}`,
                    path
                });
                highlightPath(path);
                return;
            }

            //set current state to the state reached on given input & add to path
            currentState = targetState;
            path.push(currentState);
        }

        // Check if the current state is an accepting state and set message
        const isAccepted = acceptingStates.has(states.find(s => s.label === currentState)?.id);

        setTestResult({
            accepted: isAccepted,
            message: isAccepted ? 'Accepted' : 'Rejected: Ended in non-accepting state',
            path
        });
        highlightPath(path);
    };
    const testNFAInput = () => {
        // Ensure states and transitions are properly defined
        if (!states || !transitions) {
            setTestResult({
                accepted: false,
                message: 'Error: States, transitions, or input string not properly defined',
                path: []
            });
            return;
        }

        // Optimized transition lookup: Map source and label to array of targets
        const transitionMap = new Map();
        const epsilonMap = new Map();

        transitions.forEach(t => {
            if (t.label === "ε") {
                if (!epsilonMap.has(t.source)) {
                    epsilonMap.set(t.source, []);
                }
                epsilonMap.get(t.source).push(t.target);
            } else {
                const key = `${t.source}-${t.label}`;
                if (!transitionMap.has(key)) {
                    transitionMap.set(key, []);
                }
                transitionMap.get(key).push(t.target);
            }
        });

        // Helper function to perform DFS from a given state with remaining input
        const dfs = (currentState, remainingInput, currentPath, visitedEpsilon = new Set()) => {
            // Check if current state is accepting when no input remains
            if (remainingInput.length === 0) {
                const stateObj = states.find(s => s.label === currentState);
                if (stateObj && acceptingStates.has(stateObj.id)) {
                    return { accepted: true, path: currentPath };
                }
            }

            // Try epsilon transitions first (can happen with or without input)
            const epsTargets = epsilonMap.get(currentState) || [];
            for (const target of epsTargets) {
                if (!visitedEpsilon.has(target)) {
                    const result = dfs(
                        target,
                        remainingInput,
                        [...currentPath, target],
                        new Set([...visitedEpsilon, target])
                    );
                    if (result) return result;
                }
            }

            // If input remains, try symbol transitions
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



        // Start the search from the initial state
        const startStateLabel = states.find(s => s.id === startState)?.label;

        if (!startStateLabel) {
            setTestResult({
                accepted: false,
                message: 'Error: Start state not properly defined',
                path: []
            });
            return;
        }

        // Convert input string to array of characters
        const inputArray = Array.from(testString);
        const result = dfs(startStateLabel, inputArray, [startStateLabel]);

        if (result) {
            setTestResult({
                accepted: true,
                message: 'Accepted',
                path: result.path
            });
        } else {
            setTestResult({
                accepted: false,
                message: 'Rejected: No accepting path found',
                path: []
            });
        }

        // Highlight the accepting path if one was found
        if (result && result.path) {
            highlightPath(result.path);
        }
    };

    // Function to highlight the path in the visualization
    const highlightPath = (path) => {
        if (!graph || !states || path.length === 0) return;

        // Reset all states and transitions to default appearance
        states.forEach(state => {
            state.node.attr('body/fill',
                acceptingStates.has(state.id) ? '#90EE90' : '#ccccff'
            );
        });

        graph.getLinks().forEach(link => {
            link.attr('line/stroke', 'black');
            link.attr('line/strokeWidth', 2);
        });

        // Highlight the states and transitions in the path
        for (let i = 0; i < path.length - 1; i++) {
            const currentState = path[i];
            const nextState = path[i + 1];

            const currentNode = states.find(s => s.label === currentState).node;
            if (currentNode) {
                currentNode.attr('body/fill', '#FFB6C1');
            }

            const link = graph.getLinks().find(link =>
                link.getSourceElement().id === currentNode.id &&
                link.getTargetElement().id === states.find(s => s.label === nextState).node.id
            );

            if (link) {
                link.attr('line/stroke', '#FF69B4');
                link.attr('line/strokeWidth', 3);
            }
        }

        // Highlight the final state reached
        const finalState = states.find(s => s.label === path[path.length - 1]).node;
        if (finalState) {
            finalState.attr('body/fill', '#FF69B4');
        }
    };

    // Function to reset highlighting
    const resetHighlighting = () => {
        if (!graph || !states) return;

        // Reset states to default colors
        states.forEach(state => {
            if(state.id === startState){
                state.node.attr('body/fill', '#FFE4E1');
            }
            else{
                state.node.attr('body/fill',
                    acceptingStates.has(state.id) ? '#90EE90' : '#ccccff'
                );
            }

        });

        // Reset transitions to default appearance
        graph.getLinks().forEach(link => {
            link.attr('line/stroke', 'black');
            link.attr('line/strokeWidth', 2);
        });
    };
  // Handle file uploads for equivalence testing
  const loadExample = (type) => {
    let data;
    if (type === 'DFA_ENDS_WITH_1') {
      data = {
        machineType: 'DFA',
        startState: 'q0_id',
        states: [
          { id: 'q0_id', label: 'q0', x: 120, y: 100, isAccepting: false },
          { id: 'q1_id', label: 'q1', x: 260, y: 100, isAccepting: true }
        ],
        transitions: [
          { sourceId: 'q0_id', targetId: 'q0_id', label: '0', source: 'q0', target: 'q0' },
          { sourceId: 'q0_id', targetId: 'q1_id', label: '1', source: 'q0', target: 'q1' },
          { sourceId: 'q1_id', targetId: 'q0_id', label: '0', source: 'q1', target: 'q0' },
          { sourceId: 'q1_id', targetId: 'q1_id', label: '1', source: 'q1', target: 'q1' }
        ]
      };
    } else if (type === 'NFA_CONTAINS_101') {
      data = {
        machineType: 'NFA',
        startState: 'q0_id',
        states: [
          { id: 'q0_id', label: 'q0', x: 100, y: 100, isAccepting: false },
          { id: 'q1_id', label: 'q1', x: 240, y: 100, isAccepting: false },
          { id: 'q2_id', label: 'q2', x: 380, y: 100, isAccepting: false },
          { id: 'q3_id', label: 'q3', x: 520, y: 100, isAccepting: true }
        ],
        transitions: [
          { sourceId: 'q0_id', targetId: 'q0_id', label: '0', source: 'q0', target: 'q0' },
          { sourceId: 'q0_id', targetId: 'q0_id', label: '1', source: 'q0', target: 'q0' },
          { sourceId: 'q0_id', targetId: 'q1_id', label: '1', source: 'q0', target: 'q1' },
          { sourceId: 'q1_id', targetId: 'q2_id', label: '0', source: 'q1', target: 'q2' },
          { sourceId: 'q2_id', targetId: 'q3_id', label: '1', source: 'q2', target: 'q3' },
          { sourceId: 'q3_id', targetId: 'q3_id', label: '0', source: 'q3', target: 'q3' },
          { sourceId: 'q3_id', targetId: 'q3_id', label: '1', source: 'q3', target: 'q3' }
        ]
      };
    }

    if (data) renderMachineData(data);
  };
  const handleDfaFileUpload = (fileNumber, event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const dfa = JSON.parse(e.target.result);
          if (fileNumber === 1) {
            setDfa1(dfa);
          } else {
            setDfa2(dfa);
          }
        } catch (error) {
          alert('Error reading file: ' + error.message);
        }
      };
      reader.readAsText(file);
    }
  };
    // Function to check DFA equivalence
    const checkDfaEquivalence = () => {
        if (!dfa1 || !dfa2) {
          alert('Please upload both DFA files first');
          return;
        }

        // Basic validation that both are DFAs
        if (dfa1.machineType !== 'DFA' || dfa2.machineType !== 'DFA') {
          setEquivalenceResult({
            equivalent: false,
            message: 'Both machines must be DFAs'
          });
          return;
        }

        // Pre-map transitions for faster lookup
        const getTransMap = (dfa) => {
            const map = new Map();
            dfa.transitions.forEach(t => map.set(`${t.sourceId}-${t.label}`, t.targetId));
            return map;
        };
        const transMap1 = getTransMap(dfa1);
        const transMap2 = getTransMap(dfa2);

        const stateMap1 = new Map(dfa1.states.map(s => [s.id, s]));
        const stateMap2 = new Map(dfa2.states.map(s => [s.id, s]));

        const newMachine = {
            machineType: "DFA",
            startState: null,
            states: [],
            transitions: []
        }

        const alphabet = new Set();
        dfa1.transitions.forEach(t => alphabet.add(t.label));

        let statesToProcess = [];

        const currState1 = stateMap1.get(dfa1.startState);
        const currState2 = stateMap2.get(dfa2.startState);
        const currStatePair = {
            id: `${currState1.id},${currState2.id}`,
            label: `${currState1.label},${currState2.label}`,
            isAccepting:
              (currState1.isAccepting && !currState2.isAccepting) ||
              (!currState1.isAccepting && currState2.isAccepting)
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
                        isAccepting:
                            (nextState1.isAccepting && !nextState2.isAccepting) ||
                            (!nextState1.isAccepting && nextState2.isAccepting)
                    };

                    const newTransition = {
                        sourceId: currentPair.id,
                        targetId: nextStatePair.id,
                        label: letter
                    };

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
                    message: `DFAs are not equivalent - Found distinguishing state: ${currentState.label}`
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

        setEquivalenceResult({
            equivalent: true,
            message: 'Analysis complete. The DFAs are equivalent.'
        });
    };

    const convertNfaToDfa = () => {
        if (machineType !== 'NFA' || !startState) {
            alert('Please select NFA mode and ensure a start state is set.');
            return;
        }

        // 1. Build transition and epsilon maps
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

        // 2. Epsilon closure helper
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

        // 3. Setup Subset Construction
        const initialClosure = getEpsilonClosure([startState]);
        const closureKey = (arr) => arr.join(',');

        const visitedClosures = new Set();
        const queue = [initialClosure];
        visitedClosures.add(closureKey(initialClosure));

        const dfaStates = [];
        const dfaTransitions = [];
        const stateMap = new Map();

        let stateIdCounter = 0;

        const getOrCreateDfaState = (closure) => {
            const key = closureKey(closure);
            if (stateMap.has(key)) return stateMap.get(key);

            const isAccepting = closure.some(id => acceptingStates.has(id));
            const labels = closure.map(id => states.find(s => s.id === id)?.label).filter(Boolean);
            const label = `{${labels.join(',')}}` || `S${stateIdCounter}`;

            const newState = {
                id: `dfa_s${stateIdCounter++}`,
                label,
                closure,
                isAccepting
            };

            stateMap.set(key, newState);
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
                        target: nextDfaState.label
                    });

                    if (!visitedClosures.has(key)) {
                        visitedClosures.add(key);
                        queue.push(nextClosure);
                    }
                }
            });
        }

        // Render the new DFA on canvas
        graph.clear();
        setStates([]);
        setTransitions([]);
        setStateCounter(0);
        setAcceptingStates(new Set());
        setStartState(null);
        setMachineType('DFA');

        const circlesPerRow = 5;
        const horizontalSpacing = 140;
        const verticalSpacing = 140;
        const startX = 120;
        const startY = 100;

        const newStates = [];
        const newAccepting = new Set();

        dfaStates.forEach((st, idx) => {
            const x = startX + (idx % circlesPerRow) * horizontalSpacing;
            const y = startY + Math.floor(idx / circlesPerRow) * verticalSpacing;

            const circle = new shapes.standard.Circle({ id: st.id });
            circle.position(x, y);
            circle.resize(60, 60);
            circle.attr({
                body: {
                    fill: st.isAccepting ? '#90EE90' : st.id === startDfaState.id ? '#FFE4E1' : '#ccccff',
                    strokeWidth: 3
                },
                label: { text: st.label, fill: 'black', fontWeight: 'bold' }
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
            const key = `${tr.sourceId}-${tr.targetId}`;
            if (!linkMap.has(key)) linkMap.set(key, []);
            linkMap.get(key).push(tr.label);
        });

        const newTransitions = [];

        linkMap.forEach((labels, key) => {
            const [sourceId, targetId] = key.split('-');
            const combinedLabel = labels.join(', ');

            const link = new shapes.standard.Link();
            link.source({ id: sourceId });
            link.target({ id: targetId });

            if (sourceId === targetId) {
                link.router({
                    name: 'manhattan',
                    args: { padding: 20, startDirections: ['top'], endDirections: ['bottom'] }
                });
                link.connector('rounded');
            } else {
                link.router({
                    name: 'manhattan',
                    args: { padding: 20, startDirections: ['top', 'left', 'bottom', 'right'], endDirections: ['top', 'left', 'bottom', 'right'] }
                });
            }

            link.attr({
                line: {
                    stroke: 'black',
                    strokeWidth: 2,
                    targetMarker: { type: 'path', d: 'M 10 -5 0 0 10 5 Z', fill: 'black' }
                }
            });

            link.labels([{
                attrs: { text: { text: combinedLabel, fontSize: 14, fontWeight: 'bold' } },
                position: 0.5
            }]);

            link.addTo(graph);

            labels.forEach(lbl => {
                newTransitions.push({
                    sourceId,
                    targetId,
                    label: lbl,
                    source: dfaStates.find(s => s.id === sourceId)?.label,
                    target: dfaStates.find(s => s.id === targetId)?.label
                });
            });
        });

        setTransitions(newTransitions);
    };

    const clearMachine = () => {
        // Clear the graph
        graph.clear();

        // Reset all states
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

    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: '1000px'}}>
            <div>
                <div>
                <select
                    value={machineType || ''}
                    onChange={(e) => setMachineType(e.target.value)}
                >
                    <option value="" disabled>
                        Select Machine Type
                    </option>
                    <option value="DFA">DFA</option>
                    <option value="NFA">NFA</option>
                </select>

                    <button onClick={addState} className="button">Add State</button>
                    <button onClick={startAddingTransition} disabled={isAddingTransition} className="button">Add Transition</button>
                    <button onClick={saveMachine} className="button">Save Machine</button>
                    <input type="file" onChange={loadMachine} accept=".json" style={{ display: 'none' }} id="fileInput"/>
                    <button onClick={() => document.getElementById('fileInput').click()} className="button">
                        Load Machine
                    </button>
                    <button onClick={clearMachine} className="button">Clear Machine</button>
                    {machineType === "NFA" && (
                        <button onClick={convertNfaToDfa} className="button" style={{ marginLeft: '5px', backgroundColor: '#10b981' }}>
                            Convert to DFA
                        </button>
                    )}
                    {machineType === "DFA" && (
                        <button onClick={() => alert('Minimization coming soon!')} className="button" style={{ marginLeft: '5px', backgroundColor: '#f59e0b' }}>
                            Minimize DFA
                        </button>
                    )}
                    <div style={{ marginTop: '10px' }}>
                        <button onClick={() => loadExample('DFA_ENDS_WITH_1')} className="button">Load Example 1</button>
                        <button onClick={() => loadExample('NFA_CONTAINS_101')} className="button" style={{ marginLeft: '5px' }}>Load Example 2</button>
                    </div>
                    {machineType === "NFA" &&
                        (
                            <h4 style={{color : 'black'}}>Epsilon symbol for NFA (copy and paste) ε</h4>
                    )}
                    <div style={{ marginTop: '10px' }}>
                    <h4 style={{ color: 'black' }}>Set Starting State</h4>
                    <select
                        value={startState || ''}
                        onChange={(e) => setStartingState(e.target.value)}
                    >
                        <option value="">Select Starting State</option>
                        {states.map(state => (
                            <option key={state.id} value={state.id}>{state.label}</option>
                        ))}
                    </select>
                </div>
                    <div className="test-container">
                        <h4>Test String (Starting from {states.find(s => s.id === startState)?.label})</h4>

                        {/* String input and test button */}
                        <div style={{ marginTop: '5px' }}>
                            <input
                                type="text"
                                value={testString}
                                onChange={(e) => {
                                    //on change of input reset path and test result
                                    resetHighlighting();
                                    setTestString(e.target.value);
                                    setTestResult(null);
                                }}
                                placeholder="Enter test string"
                            />
                            <button
                                onClick={machineType === "DFA" ? testInput : testNFAInput}
                                //disabled={}
                                className="button"
                            >
                                Test String
                            </button>
                        </div>
                        <div className="test-container">
                            <h4>DFA Equivalence Test(Upload 2 DFA JSON files)</h4>
                            <div>
                                <input
                                    type="file"
                                    onChange={(e) => handleDfaFileUpload(1, e)}
                                    accept=".json"
                                    style={{color:'black'}}
                                />
                                <input
                                    type="file"
                                    onChange={(e) => handleDfaFileUpload(2, e)}
                                    accept=".json"
                                    style={{color:'black'}}
                                />
                                <button
                                    onClick={checkDfaEquivalence}
                                    className="button"
                                    disabled={!dfa1 || !dfa2}
                                >
                                    Check Equivalence
                                </button>
                            </div>

                            {equivalenceResult && (
                                <div style={{
                                    marginTop: '10px',
                                    padding: '5px',
                                    backgroundColor: equivalenceResult.equivalent ? 'green' : 'red',
                                    borderRadius: '4px'
                                }}>
                                    <strong>Result:</strong> {equivalenceResult.message}
                                </div>
                            )}
                        </div>

                            {/* Result display */}
                            {testResult && (
                                <div style={{
                                    marginTop: '10px',
                                    padding: '5px',
                                    backgroundColor: testResult.accepted ? 'green' : 'red',
                                    borderRadius: '4px'
                                }}>
                                    <strong>Result:</strong> {testResult.message}
                                    {testResult.path && (
                                        <div>
                                            <strong>Path:</strong> {testResult.path.join(' → ')}
                                        </div>
                                    )}
                                </div>
                            )}
                    </div>

                        {isAddingTransition && (
                            <div style={{ marginTop: '10px' }}>
                                <h4>Adding Transition</h4>
                                <select onChange={(e) => setTransitionSource(e.target.value)} value={transitionSource || ''}>
                                    <option value="">Select Source State</option>
                                    {states.map(state => (
                                        <option key={state.id} value={state.id}>{state.label}</option>
                                    ))}
                                </select>

                                <select onChange={(e) => setTransitionTarget(e.target.value)} value={transitionTarget || ''}>
                                    <option value="">Select Target State</option>
                                    {states.map(state => (
                                        <option key={state.id} value={state.id}>{state.label}</option>
                                    ))}
                                </select>

                                <input
                                    type="text"
                                    placeholder="Transition Character"
                                    value={transitionLabel}
                                    onChange={(e) => setTransitionLabel(e.target.value)}
                                    maxLength="1"
                                />

                                <button
                                    className="confirm-transition-button button"
                                    onClick={confirmTransition}
                                    disabled={!transitionSource || !transitionTarget || !transitionLabel}
                                >
                                    Confirm Transition
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="diagram-container">
                        <h3 className="diagram-title">DFA/NFA State Diagram</h3>
                        <div ref={paperRef} style={{ width: '600px', height: '600px' }}></div>
                    </div>
                </div>

                <div style={{ marginLeft: '20px' }}>
                    <h3 style={{ color: 'black' }}>All States</h3>
                    <div style={{ marginBottom: '20px' }}>
                        {states.map(state => (
                            <div key={state.id} style={{ marginBottom: '5px' }}>
                                <label style={{ color: 'black' }}>
                                    <input
                                        type="checkbox"
                                        checked={acceptingStates.has(state.id)}
                                        onChange={() => toggleAcceptingState(state.id)}
                                    />
                                    {state.label} (Toggle Accepting State)
                                </label>
                            </div>
                        ))}
                    </div>

                    <h3 style={{ color: 'black' }}>All Transitions</h3>
                    <ul>
                        {transitions.map((t, index) => (
                            <li key={index} style={{ color: 'black' }}>{`${t.source} --${t.label}--> ${t.target}`}</li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    };

export default DfaNfaVisualizer;
