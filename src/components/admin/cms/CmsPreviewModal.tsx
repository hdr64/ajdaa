import React, { useState, useEffect } from 'react';
import { CmsLivePreviewPane } from './CmsLivePreviewPane';

interface CmsPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRoute?: string;
}

export const CmsPreviewModal: React.FC<CmsPreviewModalProps> = ({
  isOpen,
  onClose,
  initialRoute = '/',
}) => {
  const [currentPath, setCurrentPath] = useState(initialRoute);

  useEffect(() => {
    if (isOpen) {
      setCurrentPath(initialRoute);
    }
  }, [isOpen, initialRoute]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      className="fixed inset-0 z-50 flex flex-col p-2 sm:p-4 bg-black/80 backdrop-blur-md transition-all duration-200"
    >
      <CmsLivePreviewPane
        currentPath={currentPath}
        onPathChange={setCurrentPath}
        onClose={onClose}
        isSplitView={false}
      />
    </div>
  );
};
