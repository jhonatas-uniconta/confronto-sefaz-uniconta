import React from 'react';
import { Upload, CheckCircle, AlertCircle, FileText, Files, X } from 'lucide-react';

interface FileUploadProps {
    label: string;
    accept: string;
    onFileSelect: (files: File[]) => void;
    fileName?: string;
    disabled?: boolean;
    multiple?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ label, accept, onFileSelect, fileName, disabled, multiple = false }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileSelect(Array.from(e.target.files));
        }
    };

    return (
        <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
            <div className="flex items-center gap-3">
                <label className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg border transition-all cursor-pointer select-none
                    ${disabled 
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                        : 'bg-white text-slate-700 border-gray-300 hover:border-blue-500 hover:shadow-sm'
                    }
                `}>
                    {multiple ? <Files size={18} /> : <Upload size={18} />}
                    <span className="text-sm font-medium">{multiple ? 'Escolher Arquivos' : 'Escolher Arquivo'}</span>
                    <input 
                        type="file" 
                        className="hidden" 
                        accept={accept} 
                        onChange={handleChange} 
                        disabled={disabled}
                        multiple={multiple}
                    />
                </label>
                {fileName ? (
                    <span className="text-sm text-green-600 flex items-center gap-1">
                        <CheckCircle size={16} /> {fileName}
                    </span>
                ) : (
                    <span className="text-sm text-gray-400 italic">Nenhum arquivo selecionado</span>
                )}
            </div>
        </div>
    );
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { 
    variant?: 'primary' | 'secondary' | 'success' | 'outline' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
}> = ({ 
    children, 
    variant = 'primary', 
    size = 'md',
    className = '', 
    ...props 
}) => {
    const sizeStyles = {
        sm: "px-3 py-1.5 text-xs h-8",
        md: "px-4 py-2 text-sm",
        lg: "px-5 py-2.5 text-base"
    };

    const baseStyle = "rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm";
    
    const variants = {
        primary: "bg-[#151f32] text-white hover:bg-slate-900 active:bg-slate-950",
        secondary: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
        success: "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800",
        outline: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 active:bg-slate-100",
        danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
        ghost: "bg-transparent text-slate-600 hover:bg-slate-100 shadow-none border-none"
    };

    return (
        <button className={`${baseStyle} ${sizeStyles[size]} ${variants[variant]} ${className}`} {...props}>
            {children}
        </button>
    );
};

export const Card: React.FC<{ 
    title: string; 
    subtitle?: string; 
    children: React.ReactNode; 
    icon?: React.ReactNode;
    headerRight?: React.ReactNode;
    className?: string;
}> = ({ title, subtitle, children, icon, headerRight, className = '' }) => {
    return (
        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col ${className}`}>
            <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                    {icon && <div className="text-blue-600 mt-0.5">{icon}</div>}
                    <div>
                        <h3 className="font-semibold text-gray-900">{title}</h3>
                        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
                    </div>
                </div>
                {headerRight && <div>{headerRight}</div>}
            </div>
            <div className="p-5 flex-1">
                {children}
            </div>
        </div>
    );
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    let style = "bg-gray-100 text-gray-700";
    if (status === 'Lançada') style = "bg-emerald-100 text-emerald-800 border border-emerald-200";
    else if (status === 'Não Lançada') style = "bg-red-50 text-red-700 border border-red-200";
    else if (status === 'Cancelada') style = "bg-orange-50 text-orange-700 border border-orange-200";
    else if (status === 'Autorizada') style = "bg-blue-50 text-blue-700 border border-blue-200";
    else if (status === 'Não encontrada na SEFAZ') style = "bg-yellow-50 text-yellow-700 border border-yellow-200";
    
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${style}`}>
            {status}
        </span>
    );
};

export const Modal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl';
}> = ({ isOpen, onClose, title, subtitle, icon, children, maxWidth = 'lg' }) => {
    if (!isOpen) return null;

    const maxW = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '4xl': 'max-w-4xl',
        '5xl': 'max-w-5xl'
    }[maxWidth];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
            <div className={`bg-white rounded-xl shadow-2xl w-full ${maxW} overflow-hidden flex flex-col max-h-[90vh] my-auto`}>
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-2">
                        {icon && <div className="text-blue-600">{icon}</div>}
                        <div>
                            <h3 className="font-semibold text-gray-800">{title}</h3>
                            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-5 overflow-y-auto flex-1">
                    {children}
                </div>
            </div>
        </div>
    );
};

export const UnicontaLogo: React.FC<{ className?: string }> = ({ className = 'h-8 w-auto' }) => (
    <svg viewBox="0 0 260 180" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <g transform="skewX(-20)">
            <rect x="70" y="10" width="35" height="35" rx="4" fill="currentColor" />
            <rect x="115" y="10" width="35" height="35" rx="4" fill="currentColor" />
            <rect x="160" y="10" width="35" height="35" rx="4" fill="currentColor" />
            <rect x="205" y="10" width="35" height="35" rx="4" fill="currentColor" />
            <rect x="55" y="55" width="35" height="35" rx="4" fill="currentColor" />
            <rect x="100" y="55" width="35" height="35" rx="4" fill="currentColor" />
            <rect x="145" y="55" width="35" height="35" rx="4" fill="currentColor" />
            <rect x="190" y="55" width="35" height="35" rx="4" fill="currentColor" />
            <rect x="40" y="100" width="35" height="35" rx="4" fill="currentColor" />
            <rect x="85" y="100" width="35" height="35" rx="4" fill="currentColor" />
            <rect x="130" y="100" width="35" height="35" rx="4" fill="currentColor" />
            <rect x="175" y="100" width="35" height="35" rx="4" fill="currentColor" />
        </g>
    </svg>
);
