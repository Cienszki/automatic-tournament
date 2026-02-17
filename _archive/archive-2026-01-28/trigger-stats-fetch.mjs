// Browser-compatible fetch to trigger the API
import fetch from 'node-fetch';

async function triggerStatsRecalculation() {
  try {
    console.log('Triggering stats recalculation...');
    
    const response = await fetch('http://localhost:3000/api/admin/recalculateAllStats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    if (response.ok) {
      const result = await response.json();
      console.log('Success:', result);
    } else {
      const error = await response.text();
      console.log('Error response:', error);
    }
    
  } catch (error) {
    console.error('Request failed:', error);
  }
}

triggerStatsRecalculation();
