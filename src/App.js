import React, {useState} from 'react';
import moment from 'moment';
import logo from './logo.svg';
import './App.css';
import pad from 'pad-left';
import {Button, Container, Divider, Grid, Header, Input, List, Segment, TextArea} from 'semantic-ui-react';

let socket = null;
const dataToCsvURI = (data) => encodeURI(
    `data:text/csv;charset=utf-8,${data.map((row, index) =>  row.join(',')).join(`\n`)}`
);

function Node({node}) {

  const [taskDetails, setTaskDetails] = useState({
    taskId: 0xbb,
    date: moment().format('YYYY-MM-DD'),
    time: moment().format('HH:mm'),
    miliseconds: 0,
  })

  const saveNodeTimeResults = (address) => {
    if (!timeResults[address]) {
      alert('No given address in time results');
      return;
    }

    window.open(dataToCsvURI(timeResults[address]));

  }

  return <div>
    <Header as='h3' content={`Node 0x${pad(node.address.toString(16), 4, 0)}`} textAlign="center" />
    <Divider />
    <Segment>
      <Header as='h4' content='Manage' />
      <Divider />
      <Button color="red" onClick={(e) => {
        e.preventDefault();

        sendData('nodeDelete', {
          address: node.address,
        });


      }}>Unprovision</Button>
      <Button color="blue" onClick={(e) => {
        e.preventDefault();

        sendData('otaUpdate', {
          address: node.address,
        });
      }}>OTA Update</Button>
      <Button color="blue" onClick={(e) => {
        e.preventDefault();

        saveNodeTimeResults(node.address)
      }}>Save time results</Button>
    </Segment>
    <Segment>
      <Header as='h4' content='Enqueue task' />
      <Divider />
      <div>
        <Input type="number" label="Function ID" value={taskDetails.taskId} onChange={(event) => {
          setTaskDetails({
            ...taskDetails,
            taskId: event.target.value,
          })
        }}/>
      </div>
      <div>
        <Input type="date" label="Date" value={taskDetails.date} onChange={(event) => {
          setTaskDetails({
            ...taskDetails,
            date: event.target.value,
          })
        }}/>
      </div>
      <div>
        <Input type="time" label="Time" value={taskDetails.time} onChange={(event) => {
          setTaskDetails({
            ...taskDetails,
            time: event.target.value,
          })
        }}/>
      </div>
      <div>
        <Input type="number" label="Miliseconds" value={taskDetails.miliseconds} onChange={(event) => {
          setTaskDetails({
            ...taskDetails,
            miliseconds: event.target.value,
          })
        }}/>
      </div>
      <Button primary onClick={(event) => {
        event.preventDefault();

        console.log(taskDetails);

        const time = moment(`${taskDetails.date} ${taskDetails.time}`);
        time.add(taskDetails.miliseconds, 'ms');

        sendData('taskAdd', {
          address: node.address,
          funcCode: taskDetails.taskId,
          timestamp: time.valueOf(),
        });

      }}>Enqueue task</Button>
    </Segment>
  </div>
}

const sendData = (id, data={}) => {
  if (!socket) {
    console.warn('No socket opened to send');
    return;
  }

  try {
    socket.send(JSON.stringify({
      id,
      ...data,
    }));
  } catch (e) {
    console.error('Could not send', id, e);
  }
}

const startADCTests = () => {
  setInterval(() => {
    sendData('taskAdd', {
      address: 0xFFFF,
      funcCode: 0xBC,
      timestamp: moment().add(7, 'seconds').add(756, 'milliseconds').valueOf(),
    });
  }, 23000);
}

let logData = '';
let currentNodes = [];
let currentTasks = [];
const broadcastNode = {
  address: 0xFFFF,
}

const timeResults = {};

const SERVER = 'ws://192.168.0.200:8080';

function App() {

  const [connected, setConnected] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [log, setLog] = useState('');

  const onMessage = (message) => {
    let idx;
    try {
      const data = JSON.parse(message.data);
      console.log('current nodes', nodes);
      switch (data.id) {
        case 'log':
          logData += '\n' + data.log;
          setLog(logData);
          break;
        case 'nodeAdded':
          currentNodes = [...currentNodes, data]
          setNodes(currentNodes);
          break;
        case 'nodeDeleted':
          idx = currentNodes.findIndex((val) => Number(val.address) === Number(data.address));
          if (idx !== -1) {
            currentNodes.splice(idx, 1);
            setNodes([...currentNodes]);
            setSelectedNode(null);
          }
          break;
        case 'nodeTime':
          idx = currentNodes.findIndex((val) => Number(val.address) === Number(data.address));
          if (idx !== -1) {
            currentNodes[idx].logicTime = data.logicTime;
            currentNodes[idx].logicRate = data.logicRate;
            currentNodes[idx].recvTime = data.recvTime;
            setNodes([...currentNodes]);
          }
          if (!timeResults[data.address]) {
            timeResults[data.address] = [];
          }
          timeResults[data.address].push([
              Date.now(),
              data.recvTime - data.logicTime,
              data.logicRate,
          ]);
          break;
        case 'taskAdded':
          currentTasks = [...tasks, data];
          setTasks(currentTasks);
          break;
      }

    } catch (e) {
      console.error('Error while handling message', e);
    }
  }

  return (
    <div className="App" style={{marginTop: '4rem', marginBottom: '4rem'}}>
      <Header as='h1' content='BLE Mesh Provisioner Web' textAlign='center' />
      <Container>
        <Segment>
          <Header as='h2' content='Mesh Status' textAlign='left' />
          <Divider />
          <p>Status: {connected ? 'connected' : 'disconnected'}</p>
          <Button onClick={(event) => {
            event.preventDefault();

            setSelectedNode(null);
            setConnected(false);

            socket = new WebSocket(SERVER);
            socket.onopen = function() {
              setConnected(true);
            }
            socket.onclose = function() {
              setConnected(false);
            }
            socket.onmessage = onMessage;
          }}>Reconnect</Button>
          <Button primary onClick={(event) => {
            event.preventDefault();

            sendData('scan');
          }}>Scan</Button>
          <Button onClick={(event) => {
            event.preventDefault();

            sendData('setTimeBeacon', {enabled: false});
          }}>Disable time beacons</Button>
          <Button onClick={(event) => {
            event.preventDefault();

            sendData('setTimeBeacon', {enabled: true});
          }}>Enable time beacons</Button>
          <Button onClick={(event) => {
            event.preventDefault();
            startADCTests();
          }}>Start ADC testing</Button>
        </Segment>
        <Segment>
          <Header as='h2' content='Mesh topology' textAlign='left' />
          <Divider />
          <Grid>
          <Grid.Row columns={2}>
            <Grid.Column textAlign="left">
              <Header as='h3' content='Nodes' textAlign='center' />
              <List divided relaxed >
                { nodes.map((node, ndx) => (<List.Item key={ndx} active={node === selectedNode} onClick={() => setSelectedNode(node)}>
                  <List.Icon name='microchip' size='large' verticalAlign='middle' />
                  <List.Content >
                    <List.Header as="a">Node {node.address} [{node.uuid}]</List.Header>
                    <List.Description as="a">Addr: 0x{pad(node.address.toString(16), 4, 0)}, Time latency: {node.logicTime ? `${node.recvTime - node.logicTime}ms` : 'unknown'}</List.Description>
                  </List.Content>
                </List.Item>)) }
                <List.Item key="all" active={selectedNode === broadcastNode} onClick={() => setSelectedNode(broadcastNode)}>
                  <List.Icon name='wifi' size="large" verticalAlign="middle" />
                  <List.Content>
                    <List.Header as="a">All nodes</List.Header>
                    <List.Description as="a">Addr: 0xFFFF</List.Description>
                  </List.Content>
                </List.Item>
              </List>
            </Grid.Column>
            <Grid.Column textAlign="left">
              {selectedNode ? <Node node={selectedNode} /> : <p>No node is selected</p>}
            </Grid.Column>
          </Grid.Row>
        </Grid>
        </Segment>
        <Segment textAlign="left">
          <Header as="h2" content="Queued tasks" />
          <List divided relaxed >
            { tasks.map((task, ndx) => (<List.Item key={ndx}>
              <List.Icon name='clock' size='large' verticalAlign='middle' />
              <List.Content >
                <List.Header as="a">Function {task.funcCode} at {moment(task.timestamp).toISOString()}</List.Header>
                <List.Description as="a">Node: 0x{pad(task.address.toString(16), 4, 0)}</List.Description>
              </List.Content>
            </List.Item>)) }
          </List>
        </Segment>
        <Segment textAlign="left">
          <Header as="h2" content="Log" />
          <TextArea value={log} readOnly style={{width: '100%', height: '20rem'}}/>
        </Segment>
      </Container>
    </div>
  );
}

export default App;
