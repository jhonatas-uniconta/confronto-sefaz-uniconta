import React from 'react';
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';

interface FileUploadProps {
    label: string;
    accept: string;
    onFileSelect: (file: File) => void;
    fileName?: string;
    disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ label, accept, onFileSelect, fileName, disabled }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onFileSelect(e.target.files[0]);
        }
    };

    return (
        <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
            <div className="flex items-center gap-3">
                <label className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg border transition-all cursor-pointer
                    ${disabled 
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                        : 'bg-white text-slate-700 border-gray-300 hover:border-blue-500 hover:shadow-sm'
                    }
                `}>
                    <Upload size={18} />
                    <span className="text-sm font-medium">Escolher Arquivo</span>
                    <input 
                        type="file" 
                        className="hidden" 
                        accept={accept} 
                        onChange={handleChange} 
                        disabled={disabled}
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

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'success' | 'outline' }> = ({ 
    children, 
    variant = 'primary', 
    className = '', 
    ...props 
}) => {
    const baseStyle = "px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm";
    
    const variants = {
        primary: "bg-slate-800 text-white hover:bg-slate-900",
        secondary: "bg-blue-600 text-white hover:bg-blue-700",
        success: "bg-emerald-600 text-white hover:bg-emerald-700",
        outline: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
    };

    return (
        <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
            {children}
        </button>
    );
};

export const Card: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; icon?: React.ReactNode }> = ({ title, subtitle, children, icon }) => {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-start gap-3">
                {icon && <div className="text-blue-600 mt-0.5">{icon}</div>}
                <div>
                    <h3 className="font-semibold text-gray-900">{title}</h3>
                    {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
                </div>
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
    
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${style}`}>
            {status}
        </span>
    );
};