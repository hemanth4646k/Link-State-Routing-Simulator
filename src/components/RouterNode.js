import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';

// Register the Draggable plugin
gsap.registerPlugin(Draggable);

const RouterNode = ({ id, x, y, onDrag, onClick, isSelected, disabled }) => {
  const nodeRef = useRef(null);
  const dragInstance = useRef(null);
  
  useEffect(() => {
    if (nodeRef.current && !disabled) {
      // Initialize Draggable
      dragInstance.current = Draggable.create(nodeRef.current, {
        type: 'x,y',
        bounds: '.simulator-stage',
        onDragEnd: function() {
          onDrag(id, this.x + x, this.y + y);
        }
      })[0];
      
      // Reset position to match props
      gsap.set(nodeRef.current, { x: 0, y: 0 });
    }
    
    return () => {
      // Cleanup draggable instance
      if (dragInstance.current) {
        dragInstance.current.kill();
      }
    };
  }, [id, x, y, onDrag, disabled]);
  
  const handleClick = () => {
    if (!disabled) {
      onClick(id);
    }
  };
  
  return (
    <div
      id={`router-${id}`}
      ref={nodeRef}
      className={`router-node ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        borderColor: isSelected ? 'yellow' : 'transparent',
        opacity: disabled ? 0.7 : 1
      }}
      onClick={handleClick}
    >
      {id}
    </div>
  );
};

export default RouterNode; 