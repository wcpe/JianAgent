import { useState } from 'react';

export function ArthasTestPage() {
  const [status, setStatus] = useState('未测试');
  const [apiResult, setApiResult] = useState('');

  const testApi = async () => {
    setStatus('测试中...');
    try {
      const response = await fetch('/api/v1/jvm/processes');
      const data = await response.json();
      setStatus('成功');
      setApiResult(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setStatus('失败');
      setApiResult(err.message);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Arthas Test Page</h1>
      <p>If you can see this, routing works!</p>
      <button 
        onClick={testApi}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Test JVM API
      </button>
      <div className="mt-4">
        <p className="font-semibold">状态: {status}</p>
        {apiResult && (
          <pre className="mt-2 p-4 bg-gray-100 rounded overflow-auto max-h-96">
            {apiResult}
          </pre>
        )}
      </div>
    </div>
  );
}
