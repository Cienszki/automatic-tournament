
import { auth } from './firebase';

const createApi = () => {
  const getHeaders = async () => {
    const token = await auth.currentUser?.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const post = async (url: string, data: any) => {
    const headers = await getHeaders();
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return response.json();
  };

  return { post };
};

export const api = createApi();
