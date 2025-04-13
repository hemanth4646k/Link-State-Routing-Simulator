import React, { useState, useEffect, useRef } from 'react';
import './Tutorial.css';

const Tutorial = ({ onComplete }) => {
  console.log('Tutorial component rendered');
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [highlightPosition, setHighlightPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const tooltipRef = useRef(null);

  // Define all tutorial steps
  const tutorialSteps = [
    {
      target: 'body',
      content: 'Welcome to the Link State Algorithm Simulator! This tutorial will guide you through the basic features of this application.',
      position: 'center',
      highlight: false
    },
    {
      target: '.toolbox',
      content: 'This is the main toolbar where you can add routers, create connections, and use other tools to build your network.',
      position: 'bottom',
      highlight: true
    },
    {
      target: '.simulator-stage',
      content: 'This is the Network Graph area with a 3D interface. Here you can create and view your network topology.',
      position: 'center',
      highlight: true,
      fullOverlay: true
    },
    {
      target: '.router-template',
      content: 'Drag this template to add a new router to your network. Try adding at least two routers!',
      position: 'bottom',
      highlight: true
    },
    {
      target: 'button:contains("Move Elements")',
      content: 'Need to reposition routers? Click this button to enter Move Mode. In Move Mode, you can easily click and drag any router to reposition it.',
      position: 'bottom',
      highlight: true
    },
    {
      target: 'button:contains("Connect Routers")',
      content: 'After adding routers, click this button to connect them. Then select two routers to create a link between them.',
      position: 'bottom',
      highlight: true
    },
    {
      target: '.control-panel-container',
      content: 'Once your network has at least 2 routers and 1 link, use this control panel to start the simulation.',
      position: 'left',
      highlight: true
    },
    {
      target: '.left-panel',
      content: 'The Link State Database (LSDB) and routing tables will be displayed here during the simulation.',
      position: 'right',
      highlight: true
    },
    {
      target: '.primary-button:contains("Start Simulation")',
      content: 'Click this button to start the simulation after you\'ve created your network topology.',
      position: 'left',
      highlight: true
    },
    {
      target: '.next-step-button',
      content: 'During the simulation, click this button to advance to the next step and see how the Link State Algorithm works.',
      position: 'left',
      highlight: true
    },
    {
      target: 'button:contains("Pause Simulation")',
      content: 'You can pause the simulation at any time by clicking this button. When paused, you can still examine the LSDB and routing tables.',
      position: 'left',
      highlight: true
    },
    {
      target: 'button:contains("Reset Simulation")',
      content: 'If you need to start over, click Reset Simulation. This keeps your topology but resets all LSDB and routing data.',
      position: 'left',
      highlight: true
    },
    {
      target: 'button:contains("Send Custom Packet")',
      content: 'During the simulation, you can manually send Hello or LSP packets between routers using this feature. This helps you understand how routers communicate.',
      position: 'bottom',
      highlight: true
    },
    {
      target: 'button:contains("Help")',
      content: 'If you ever need to see this tutorial again, click the Help button in the toolbar.',
      position: 'bottom',
      highlight: true
    },
    {
      target: 'body',
      content: 'Congratulations! You\'re ready to start exploring Link State Routing. Feel free to experiment with different network topologies and see how the algorithm calculates shortest paths.',
      position: 'center',
      highlight: false
    }
  ];

  // Get current step
  const currentTutorialStep = tutorialSteps[currentStep] || {};

  // Handle next step
  const handleNextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSkipTutorial();
    }
  };

  // Handle previous step
  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Skip tutorial
  const handleSkipTutorial = () => {
    setIsVisible(false);
    if (onComplete) onComplete();
  };

  useEffect(() => {
    console.log('Tutorial useEffect - isVisible:', isVisible, 'currentStep:', currentStep);
    if (!isVisible) return;

    const positionElements = () => {
      const step = tutorialSteps[currentStep];
      if (!step) return;

      console.log('Positioning tutorial elements for step:', currentStep, 'targeting:', step.target);
      
      // Find the target element
      let targetElement;
      if (step.target === 'body') {
        targetElement = document.body;
      } else if (step.target === 'header') {
        targetElement = document.querySelector('header');
      } else if (step.target.includes(':contains(')) {
        // Handle custom selector for buttons with specific text
        const selector = step.target.split(':contains(')[0];
        const textToMatch = step.target.split(':contains("')[1].split('")')[0];
        
        // Find all elements matching the base selector
        const elements = document.querySelectorAll(selector);
        targetElement = Array.from(elements).find(el => 
          el.textContent.includes(textToMatch)
        );
      } else {
        targetElement = document.querySelector(step.target);
      }

      if (!targetElement) {
        console.log('Target element not found for:', step.target);
        // If target not found and it's the first step, default to center of screen
        if (currentStep === 0) {
          setTooltipPosition({
            top: window.innerHeight / 2 - 150,
            left: window.innerWidth / 2 - 150
          });
        }
        return;
      }

      console.log('Target element found:', targetElement);
      
      // Special case for simulator-stage (network graph area)
      const isSimulatorStage = step.target === '.simulator-stage';
      
      // Get the target element's position and dimensions
      const targetRect = targetElement.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      // Set highlight position
      setHighlightPosition({
        top: targetRect.top + scrollTop,
        left: targetRect.left + scrollLeft,
        width: targetRect.width,
        height: targetRect.height
      });

      // Set tooltip position based on the specified position
      if (tooltipRef.current) {
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const margin = 10; // Margin between tooltip and target element

        let top, left;

        if (step.position === 'center') {
          // For simulator-stage or other center-positioned tooltips
          if (isSimulatorStage) {
            // Position in center of the simulator stage
            top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2 + scrollTop;
            left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2 + scrollLeft;
          } else {
            // Position in center of screen
            top = window.innerHeight / 2 - tooltipRect.height / 2;
            left = window.innerWidth / 2 - tooltipRect.width / 2;
          }
        } else {
          switch (step.position) {
            case 'top':
              top = targetRect.top - tooltipRect.height - margin + scrollTop;
              left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2 + scrollLeft;
              break;
            case 'bottom':
              top = targetRect.bottom + margin + scrollTop;
              left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2 + scrollLeft;
              break;
            case 'left':
              top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2 + scrollTop;
              left = targetRect.left - tooltipRect.width - margin + scrollLeft;
              break;
            case 'right':
              top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2 + scrollTop;
              left = targetRect.right + margin + scrollLeft;
              break;
            default:
              top = targetRect.bottom + margin + scrollTop;
              left = targetRect.left + scrollLeft;
          }

          // Keep tooltip within viewport
          if (left < 0) left = margin;
          if (left + tooltipRect.width > window.innerWidth) left = window.innerWidth - tooltipRect.width - margin;
          if (top < 0) top = margin;
          if (top + tooltipRect.height > window.innerHeight + scrollTop) 
            top = window.innerHeight + scrollTop - tooltipRect.height - margin;
        }

        setTooltipPosition({ top, left });
      }
    };

    // Call once immediately to avoid flicker
    positionElements();

    // Set up resize and scroll event listeners
    window.addEventListener('resize', positionElements);
    window.addEventListener('scroll', positionElements);

    return () => {
      window.removeEventListener('resize', positionElements);
      window.removeEventListener('scroll', positionElements);
    };
  }, [currentStep, isVisible, tutorialSteps]);

  // Add an effect that will directly manipulate DOM elements when showing simulator-stage
  useEffect(() => {
    // Only run this effect for the simulator-stage step
    if (isVisible && currentTutorialStep.target === '.simulator-stage') {
      console.log('Applying direct DOM manipulations for simulator-stage');
      
      // Directly target the elements we want to darken
      const toolbox = document.querySelector('.toolbox');
      const leftPanel = document.querySelector('.left-panel');
      const rightPanel = document.querySelector('.right-panel');
      const leftToggle = document.querySelector('.left-panel-toggle');
      const rightToggle = document.querySelector('.right-panel-toggle');
      
      // Add a class to all these elements
      [toolbox, leftPanel, rightPanel, leftToggle, rightToggle].forEach(el => {
        if (el) {
          el.classList.add('tutorial-darkened');
        }
      });
      
      // Create a style tag for our custom class if it doesn't exist
      let styleTag = document.getElementById('tutorial-styles');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'tutorial-styles';
        styleTag.innerHTML = `
          .tutorial-darkened {
            opacity: 0.1 !important;
            pointer-events: none !important;
            z-index: 1 !important;
          }
        `;
        document.head.appendChild(styleTag);
      }
      
      return () => {
        // Remove the class when this effect is cleaned up
        [toolbox, leftPanel, rightPanel, leftToggle, rightToggle].forEach(el => {
          if (el) {
            el.classList.remove('tutorial-darkened');
          }
        });
      };
    }
  }, [isVisible, currentStep, tutorialSteps, currentTutorialStep]);

  console.log('Tutorial before return, isVisible:', isVisible);
  if (!isVisible) return null;
  
  // Ensure tooltip has a default position (center of screen) if not set yet
  if (tooltipPosition.top === 0 && tooltipPosition.left === 0) {
    setTooltipPosition({
      top: window.innerHeight / 2 - 150,
      left: window.innerWidth / 2 - 150
    });
  }

  return (
    <div className="tutorial-container">
      {/* Overlay - Only show if not highlighting a specific component */}
      {!currentTutorialStep.highlight && (
        <div className="tutorial-overlay"></div>
      )}
      
      {/* Highlighted area with special handling */}
      {currentTutorialStep.highlight && highlightPosition.width > 0 && (
        <>
          {/* For simulator-stage and other special components, use a completely different approach */}
          {currentTutorialStep.fullOverlay ? (
            // This approach uses four separate overlays to cover everything except the highlighted area
            <>
              {/* Top overlay */}
              <div className="tutorial-overlay" style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: `${highlightPosition.top}px`,
                pointerEvents: 'auto'
              }}></div>
              
              {/* Bottom overlay */}
              <div className="tutorial-overlay" style={{
                position: 'fixed',
                top: `${highlightPosition.top + highlightPosition.height}px`,
                left: 0,
                width: '100%',
                height: `${window.innerHeight - (highlightPosition.top + highlightPosition.height)}px`,
                pointerEvents: 'auto'
              }}></div>
              
              {/* Left overlay */}
              <div className="tutorial-overlay" style={{
                position: 'fixed',
                top: `${highlightPosition.top}px`,
                left: 0,
                width: `${highlightPosition.left}px`,
                height: `${highlightPosition.height}px`,
                pointerEvents: 'auto'
              }}></div>
              
              {/* Right overlay */}
              <div className="tutorial-overlay" style={{
                position: 'fixed',
                top: `${highlightPosition.top}px`,
                left: `${highlightPosition.left + highlightPosition.width}px`,
                width: `${window.innerWidth - (highlightPosition.left + highlightPosition.width)}px`,
                height: `${highlightPosition.height}px`,
                pointerEvents: 'auto'
              }}></div>
              
              {/* Highlighted area border */}
              <div 
                className="tutorial-highlight" 
                style={{
                  top: `${highlightPosition.top}px`,
                  left: `${highlightPosition.left}px`,
                  width: `${highlightPosition.width}px`,
                  height: `${highlightPosition.height}px`,
                  pointerEvents: 'none',
                  zIndex: 10001
                }}
              ></div>
            </>
          ) : (
            // Standard approach for normal components
            <>
              <div 
                className="tutorial-overlay"
                style={{
                  clipPath: `path('M 0,0 L 0,${window.innerHeight} L ${window.innerWidth},${window.innerHeight} L ${window.innerWidth},0 Z M ${highlightPosition.left},${highlightPosition.top} L ${highlightPosition.left + highlightPosition.width},${highlightPosition.top} L ${highlightPosition.left + highlightPosition.width},${highlightPosition.top + highlightPosition.height} L ${highlightPosition.left},${highlightPosition.top + highlightPosition.height} Z')`,
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%'
                }}
              ></div>
              
              <div 
                className="tutorial-highlight" 
                style={{
                  top: `${highlightPosition.top}px`,
                  left: `${highlightPosition.left}px`,
                  width: `${highlightPosition.width}px`,
                  height: `${highlightPosition.height}px`,
                  pointerEvents: 'none'
                }}
              ></div>
            </>
          )}
        </>
      )}
      
      {/* Tooltip */}
      <div 
        ref={tooltipRef}
        className="tutorial-tooltip" 
        style={{
          top: `${tooltipPosition.top}px`,
          left: `${tooltipPosition.left}px`
        }}
      >
        <p>{currentTutorialStep.content}</p>
        
        <div className="tooltip-buttons">
          <button 
            className="tooltip-prev-button" 
            onClick={handlePrevStep}
            disabled={currentStep === 0}
          >
            Previous
          </button>
          
          <button 
            className="tooltip-skip-button" 
            onClick={handleSkipTutorial}
          >
            Skip Tutorial
          </button>
          
          <button 
            className="tooltip-next-button" 
            onClick={handleNextStep}
          >
            {currentStep === tutorialSteps.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Tutorial; 