# Caspar CG Manager

This is our application that controls our caspar servers. It is started on the same machine as the caspar servers and communicates with them via the CasparCG AMCP protocol. It relays the AMCP commands over websocket and also allows for additional commands to edit configuration and control the running state of caspar. It also supports a UDP multicast protocol for discovery of caspar servers on the network. 