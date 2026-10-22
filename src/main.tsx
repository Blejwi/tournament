import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import '@/i18n';
import '@/index.css';
import { UpdatePrompt } from '@/ui/components/UpdatePrompt';
import { router } from '@/ui/router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <UpdatePrompt />
  </StrictMode>,
);
