import React, { useState } from 'react';

const LinkCostModal = ({ onAddLink, onClose }) => {
  const [cost, setCost] = useState(1);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onAddLink(cost);
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
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
              autoFocus
            />
          </div>
          
          <div className="modal-actions">
            <button type="submit">Add Link</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LinkCostModal; 