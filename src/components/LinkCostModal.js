import React, { useState } from 'react';

const LinkCostModal = ({ onAddLink, onCancel }) => {
  const [cost, setCost] = useState(1);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onAddLink(cost);
  };
  
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Set Link Cost</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="link-cost">Cost:</label>
            <input
              id="link-cost"
              type="number"
              min="1"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </div>
          
          <div className="modal-actions">
            <button type="submit">Add Link</button>
            <button type="button" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
      
      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        
        .modal-content {
          background-color: white;
          padding: 20px;
          border-radius: 4px;
          width: 300px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        
        .form-group {
          margin-bottom: 15px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 5px;
        }
        
        .form-group input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        
        .modal-actions button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .modal-actions button[type="submit"] {
          background-color: #4CAF50;
          color: white;
        }
        
        .modal-actions button[type="button"] {
          background-color: #f1f1f1;
        }
      `}</style>
    </div>
  );
};

export default LinkCostModal; 