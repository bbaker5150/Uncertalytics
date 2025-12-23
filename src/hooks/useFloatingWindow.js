import { useState, useLayoutEffect, useEffect } from 'react';

/**
 * Hook to manage floating window state + dragging logic.
 * 
 * @param {Object} config
 * @param {boolean} config.isOpen - Whether the window is currently open (triggers recentering if needed).
 * @param {number} config.defaultWidth - Width in pixels used for centering calculation.
 * @param {number} config.defaultHeight - Height in pixels used for centering calculation.
 * @param {Object} [config.initialPosition] - Optional override {x,y}.
 */
export const useFloatingWindow = ({
    isOpen,
    defaultWidth = 600,
    defaultHeight = 600,
    initialPosition = null
} = {}) => {
    // State
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Initialize Position (Center of Viewport)
    useLayoutEffect(() => {
        if (isOpen) {
            if (initialPosition) {
                setPosition(initialPosition);
            } else if (typeof window !== 'undefined') {
                const x = Math.max(0, (window.innerWidth - defaultWidth) / 2);
                const y = Math.max(0, (window.innerHeight - defaultHeight) / 2);
                setPosition({ x, y });
            }
        }
    }, [isOpen]); // Only re-center when it OPENS

    // Drag Handlers
    const handleMouseDown = (e) => {
        // Prevent drag if clicking buttons, inputs, or explicit no-drag areas
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.no-drag')) return;

        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragOffset.x,
                    y: e.clientY - dragOffset.y
                });
            }
        };
        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    return {
        position,
        setPosition, // Expose setter if manual adjustment needed
        handleMouseDown,
        // Helper style object
        style: {
            position: 'fixed',
            top: position.y,
            left: position.x,
            margin: 0
        }
    };
};

export default useFloatingWindow;
