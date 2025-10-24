import React from 'react';

const Logo: React.FC = () => {
    return (
        <div className="flex items-center justify-center mb-6 text-white">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-3 text-blue-500">
                <path d="M3 10V14M7 8V16M11 5V19M15 8V16M19 10V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="text-left">
                <h1 className="text-3xl font-bold tracking-wider">Radio Sónica</h1>
                <p className="text-sm font-light tracking-widest text-gray-400">CIENTO SEIS NUEVE</p>
            </div>
        </div>
    );
};

export default Logo;
