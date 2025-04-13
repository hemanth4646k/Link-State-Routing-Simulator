import React, { useState, useEffect, useRef } from 'react';
import './Tutorial.css';

const Tutorial = ({ onComplete }) => {
  console.log('Tutorial component rendered');
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [highlightPosition, setHighlightPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const tooltipRef = useRef(null);
  const animationRef = useRef(null);

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
      position: 'right',
      highlight: true
    },
    {
      target: '.router-template',
      content: 'Drag this template to add a new router to your network. Try adding at least two routers!',
      position: 'bottom',
      highlight: true,
      animation: 'drag'
    },
    {
      target: 'button:contains("Move Elements")',
      content: 'Need to reposition routers? Click this button to enter Move Mode. In Move Mode, you can easily click and drag any router to reposition it.',
      position: 'bottom',
      highlight: true,
      animation: 'click'
    },
    {
      target: 'button:contains("Connect Routers")',
      content: 'After adding routers, click this button to connect them. Then select two routers to create a link between them.',
      position: 'bottom',
      highlight: true,
      animation: 'click'
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
  const currentTutorialStep = tutorialSteps[currentStep];

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

  // Position the tooltip and highlight based on the target element
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
          top = window.innerHeight / 2 - tooltipRect.height / 2;
          left = window.innerWidth / 2 - tooltipRect.width / 2;
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

      // Set up animation if needed
      if (step.animation && animationRef.current) {
        if (step.animation === 'click') {
          animationRef.current.style.top = `${targetRect.top + targetRect.height / 2}px`;
          animationRef.current.style.left = `${targetRect.left + targetRect.width / 2}px`;
        } else if (step.animation === 'drag') {
          // For drag animation, position start point on the element
          animationRef.current.style.top = `${targetRect.top + targetRect.height / 2}px`;
          animationRef.current.style.left = `${targetRect.left + targetRect.width / 2}px`;
        }
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
      {/* Overlay */}
      <div className="tutorial-overlay"></div>
      
      {/* Highlighted area */}
      {currentTutorialStep.highlight && highlightPosition.width > 0 && (
        <div 
          className="tutorial-highlight" 
          style={{
            top: `${highlightPosition.top}px`,
            left: `${highlightPosition.left}px`,
            width: `${highlightPosition.width}px`,
            height: `${highlightPosition.height}px`
          }}
        ></div>
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
      
      {/* Animation */}
      {currentTutorialStep.animation && (
        <div 
          ref={animationRef}
          className={`tutorial-animation ${currentTutorialStep.animation}-animation`}
        >
          <div className="animation-dot"></div>
        </div>
      )}
    </div>
  );
};

export default Tutorial; 