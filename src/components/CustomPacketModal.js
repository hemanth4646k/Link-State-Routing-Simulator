import React, { useState, useEffect } from 'react';
import './CustomPacketModal.css';

const CustomPacketModal = ({ onClose, onSendPacket, routers, lsdbData }) => {
  const [packetType, setPacketType] = useState('hello');
  const [sourceRouter, setSourceRouter] = useState('');
  const [targetRouter, setTargetRouter] = useState('');
  const [sequenceNumber, setSequenceNumber] = useState(1);
  const [lspOwner, setLspOwner] = useState('');
  const [validSources, setValidSources] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  // When LSP owner changes, check which routers have received this LSP
  useEffect(() => {
    if (packetType === 'lsp' && lspOwner) {
      // Find routers that have received this LSP 
      const routersWithLsp = [];
      
      // Check each router's LSDB
      Object.keys(lsdbData).forEach(routerId => {
        // If the router has an entry for the LSP owner, it has seen this LSP
        if (lsdbData[routerId][lspOwner]) {
          routersWithLsp.push(routerId);
        }
      });
      
      setValidSources(routersWithLsp);
      
      // Reset source router if no longer valid
      if (sourceRouter && !routersWithLsp.includes(sourceRouter)) {
        setSourceRouter('');
      }
      
      if (routersWithLsp.length === 0) {
        setErrorMessage(`No routers have received LSPs from ${lspOwner} yet. Create an originating LSP first.`);
      } else {
        setErrorMessage('');
      }
    } else {
      setErrorMessage('');
    }
  }, [lspOwner, lsdbData, packetType]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (packetType === 'hello') {
      if (!sourceRouter || !targetRouter) {
        alert('Please select both source and neighbor routers');
        return;
      }
      
      onSendPacket({
        type: 'hello',
        source: sourceRouter,
        target: targetRouter
      });
    } else if (packetType === 'lsp') {
      if (!sourceRouter || !targetRouter || !lspOwner) {
        alert('Please select source, destination, and LSP owner routers');
        return;
      }
      
      // Check if source router has received this LSP before (except for owner's original LSPs)
      if (sourceRouter !== lspOwner && !validSources.includes(sourceRouter)) {
        alert(`Router ${sourceRouter} has not received an LSP from ${lspOwner} yet. Only routers that have received an LSP can forward it.`);
        return;
      }
      
      onSendPacket({
        type: 'lsp',
        source: sourceRouter,
        target: targetRouter,
        lspOwner: lspOwner,
        sequenceNumber: sequenceNumber
      });
    }
    
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="custom-packet-modal">
        <h2>Send Custom Packet</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="packetType">Packet Type:</label>
            <select 
              id="packetType" 
              value={packetType} 
              onChange={(e) => {
                setPacketType(e.target.value);
                setErrorMessage('');
                setLspOwner('');
              }}
            >
              <option value="hello">Hello Packet</option>
              <option value="lsp">Link State Packet (LSP)</option>
            </select>
          </div>
          
          {packetType === 'lsp' && (
            <div className="form-group">
              <label htmlFor="lspOwner">LSP Owner (Original Router):</label>
              <select 
                id="lspOwner"
                value={lspOwner}
                onChange={(e) => setLspOwner(e.target.value)}
                required
              >
                <option value="">Select LSP owner</option>
                {routers.map(router => (
                  <option key={router.id} value={router.id}>
                    Router {router.id}
                  </option>
                ))}
              </select>
              <small className="help-text">
                This is the router this LSP is about. If creating a new LSP, select the originating router.
              </small>
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="sourceRouter">Source Router (Sender):</label>
            <select 
              id="sourceRouter"
              value={sourceRouter}
              onChange={(e) => setSourceRouter(e.target.value)}
              required
              disabled={packetType === 'lsp' && lspOwner && lspOwner !== sourceRouter && validSources.length === 0}
            >
              <option value="">Select source router</option>
              {packetType === 'lsp' && lspOwner && lspOwner !== sourceRouter ? (
                // If it's an LSP being forwarded, only show routers that have received this LSP
                validSources.map(routerId => (
                  <option key={routerId} value={routerId}>
                    Router {routerId} (has received this LSP)
                  </option>
                ))
              ) : (
                // For hello packets or originating LSPs, show all routers
                routers.map(router => (
                  <option key={router.id} value={router.id}>
                    Router {router.id}
                    {packetType === 'lsp' && lspOwner === router.id && ' (Owner)'}
                  </option>
                ))
              )}
            </select>
            {packetType === 'lsp' && errorMessage && (
              <p className="error-message">{errorMessage}</p>
            )}
            {packetType === 'lsp' && (
              <small className="help-text">
                For originating LSPs, source must be the owner. For forwarded LSPs, source must have received this LSP first.
              </small>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="targetRouter">
              {packetType === 'hello' ? 'Neighbor Router:' : 'Destination Router:'}
            </label>
            <select 
              id="targetRouter"
              value={targetRouter}
              onChange={(e) => setTargetRouter(e.target.value)}
              required
              disabled={!sourceRouter}
            >
              <option value="">
                {packetType === 'hello' ? 'Select neighbor router' : 'Select destination router'}
              </option>
              {routers
                .filter(router => router.id !== sourceRouter)
                .map(router => (
                  <option key={router.id} value={router.id}>
                    Router {router.id}
                  </option>
                ))}
            </select>
          </div>
          
          {packetType === 'lsp' && (
            <div className="form-group">
              <label htmlFor="sequenceNumber">Sequence Number:</label>
              <input 
                id="sequenceNumber"
                type="number"
                min="1"
                value={sequenceNumber}
                onChange={(e) => setSequenceNumber(parseInt(e.target.value))}
                required
              />
            </div>
          )}
          
          <div className="modal-buttons">
            <button 
              type="submit" 
              className="primary-button"
              disabled={packetType === 'lsp' && lspOwner && lspOwner !== sourceRouter && validSources.length === 0}
            >
              Send Packet
            </button>
            <button type="button" onClick={onClose} className="secondary-button">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomPacketModal;
