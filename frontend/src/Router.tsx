import { createBrowserRouter, data, RouterProvider } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { ErrorPage } from './pages/Error.page';
import { EssentialsPage } from './pages/Essentials.page';
import { HomePage } from './pages/Home.page';
import { MedicationDetailPage } from './pages/MedicationDetail.page';
import { MedicationsPage } from './pages/Medications.page';
import { NewMedicationPage } from './pages/NewMedication.page';
import { StockPage } from './pages/Stock.page';

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    // Last resort, if the layout itself fails: the error page replaces everything.
    errorElement: <ErrorPage />,
    children: [
      {
        // A page that fails shows the error inside the layout, so the navigation still works.
        errorElement: <ErrorPage />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/medications', element: <MedicationsPage /> },
          // 'new' is matched before ':id', so it never reaches the detail page.
          { path: '/medications/new', element: <NewMedicationPage /> },
          { path: '/medications/:id', element: <MedicationDetailPage /> },
          { path: '/stock', element: <StockPage /> },
          { path: '/essentials', element: <EssentialsPage /> },
          // Any other address: a 404, shown by the error page above.
          {
            path: '*',
            loader: () => {
              throw data(null, { status: 404 });
            },
          },
        ],
      },
    ],
  },
]);

export function Router() {
  return <RouterProvider router={router} />;
}
